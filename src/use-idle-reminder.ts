import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "touchstart"] as const;

interface IdleReminderOptions {
  /** When false, no beep is scheduled. */
  enabled: boolean;
  /** Seconds of inactivity before the beep fires. */
  delaySec: number;
  /** When true, the reminder stops scheduling (e.g. after Done). */
  paused: boolean;
}

export function useIdleReminder({ enabled, delaySec, paused }: IdleReminderOptions): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!enabled || paused) return;

    const playBeep = () => {
      try {
        const Ctor: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") void ctx.resume();

        const now = ctx.currentTime;
        // Two short ascending tones — gentle, not alarming.
        for (const [start, freq] of [[0, 660], [0.18, 880]] as const) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, now + start);
          gain.gain.linearRampToValueAtTime(0.12, now + start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.15);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + start);
          osc.stop(now + start + 0.18);
        }
      } catch {
        // Audio is best-effort; no fallback noise needed.
      }
    };

    const arm = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        playBeep();
        arm();
      }, delaySec * 1000);
    };

    const onActivity = () => arm();

    arm();
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, onActivity, { passive: true });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity);
    };
  }, [enabled, delaySec, paused]);
}
