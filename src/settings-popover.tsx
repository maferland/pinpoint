import { useEffect, useRef } from "react";
import type { Preferences, ViewMode } from "./api.ts";
import { SegmentedControl, Toggle } from "./ui/index.tsx";

interface SettingsPopoverProps {
  prefs: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
  onClose: () => void;
}

const REMINDER_DELAY_OPTIONS = [30, 60, 120, 300];

export function SettingsPopover({ prefs, onChange, onClose }: SettingsPopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (e.target instanceof Node && rootRef.current.contains(e.target)) return;
      // The toggle button's own onClick handles closing when reclicked — if this
      // mousedown-outside handler also closes, the click that follows reopens it.
      if (e.target instanceof Element && e.target.closest("[data-settings-trigger]")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      className="absolute right-0 top-[calc(100%+6px)] z-50 w-60 rounded-[12px] border border-border shadow-token animate-pp-pop"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <div className="px-3 py-2 border-b border-border">
        <p className="font-mono text-[10px] font-semibold text-faint tracking-widest uppercase">Settings</p>
      </div>

      <div className="px-3 py-3 flex flex-col gap-4">
        <Row label="View">
          <SegmentedControl
            value={prefs.viewMode}
            options={[
              { value: "fit", label: "Fit" },
              { value: "actual", label: "Full size" },
            ] as { value: ViewMode; label: string }[]}
            onChange={(v) => onChange({ viewMode: v })}
          />
        </Row>

        <Toggle
          label="Auto-close tab after send"
          checked={prefs.autoCloseAfterDone}
          onChange={(v) => onChange({ autoCloseAfterDone: v })}
        />

        <div className="flex flex-col gap-2">
          <Toggle
            label="Idle reminder"
            checked={prefs.idleReminder}
            onChange={(v) => onChange({ idleReminder: v })}
          />
          {prefs.idleReminder && (
            <div className="flex items-center gap-2 pl-0.5">
              <span className="text-[12px] text-muted">After</span>
              <select
                className="text-[12px] text-txt rounded-[7px] px-2 py-1 border border-border bg-bg2"
                value={prefs.idleReminderDelaySec}
                onChange={(e) => onChange({ idleReminderDelaySec: parseInt(e.target.value, 10) })}
              >
                {REMINDER_DELAY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s >= 60 ? `${s / 60} min` : `${s}s`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] text-txt">{label}</span>
      {children}
    </div>
  );
}
