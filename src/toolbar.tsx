import { useEffect, useState } from "react";
import { finalizeReview } from "./api.ts";
import type { Preferences } from "./api.ts";
import { SettingsPopover } from "./settings-popover.tsx";

const AUTO_CLOSE_DELAY_MS = 3000;

interface ToolbarProps {
  reviewId: string;
  annotationCount: number;
  context?: string;
  theme: "dark" | "light";
  onThemeToggle: () => void;
  prefs: Preferences;
  prefsLoaded: boolean;
  onPrefsChange: (patch: Partial<Preferences>) => void;
  onFinalized: () => void;
  hasDetails: boolean;
  detailsVisible: boolean;
  onToggleDetails: () => void;
  onShowHotkeys: () => void;
  onBeforeExport: () => Promise<void>;
}

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const QuestionIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const GearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export function Toolbar({
  reviewId,
  annotationCount,
  context,
  theme,
  onThemeToggle,
  prefs,
  prefsLoaded,
  onPrefsChange,
  onFinalized,
  hasDetails,
  detailsVisible,
  onToggleDetails,
  onShowHotkeys,
  onBeforeExport,
}: ToolbarProps) {
  const [doneState, setDoneState] = useState<"idle" | "sending" | "sent">("idle");
  const [countdown, setCountdown] = useState<number>(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (doneState !== "sent" || !prefs.autoCloseAfterDone) return;
    setCountdown(Math.round(AUTO_CLOSE_DELAY_MS / 1000));
    const tick = setInterval(() => setCountdown((n) => (n > 0 ? n - 1 : 0)), 1000);
    const close = setTimeout(() => window.close(), AUTO_CLOSE_DELAY_MS);
    return () => { clearInterval(tick); clearTimeout(close); };
  }, [doneState, prefs.autoCloseAfterDone]);

  const sendDone = async () => {
    setDoneState("sending");
    try {
      await onBeforeExport();
      await finalizeReview(reviewId);
      setDoneState("sent");
      onFinalized();
    } catch (err) {
      console.error("Finalize failed:", err);
      setDoneState("idle");
    }
  };

  return (
    <div className="h-11 flex items-center px-4 gap-3 bg-card border-b border-border shrink-0 select-none relative">
      <div className="flex items-center gap-2 mr-2">
        <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2c-4.4 0-8 3.6-8 8 0 5.6 8 12 8 12s8-6.4 8-12c0-4.4-3.6-8-8-8z" />
            <circle cx="12" cy="10" r="2.5" />
            <line x1="12" y1="6.25" x2="12" y2="7.5" />
            <line x1="12" y1="12.5" x2="12" y2="13.75" />
            <line x1="8.25" y1="10" x2="9.5" y2="10" />
            <line x1="14.5" y1="10" x2="15.75" y2="10" />
          </svg>
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-foreground">Pinpoint</span>
      </div>
      <div className="w-px h-5 bg-border" />
      <span className="text-[12px] text-muted-foreground truncate flex-1 min-w-0">{context ?? ""}</span>
      <div className="w-px h-5 bg-border" />
      <span className="text-[12px] text-muted-foreground tabular-nums whitespace-nowrap">
        {annotationCount} pin{annotationCount !== 1 ? "s" : ""}
      </span>
      <div className="w-px h-5 bg-border" />
      {hasDetails && (
        <button
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
            detailsVisible
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
          onClick={onToggleDetails}
          title={detailsVisible ? "Hide details" : "Show details"}
          aria-label={detailsVisible ? "Hide details" : "Show details"}
        >
          <InfoIcon />
        </button>
      )}
      <button
        className={`text-[12px] px-2.5 h-7 rounded-md font-medium transition-colors whitespace-nowrap ${
          doneState === "sent"
            ? "bg-emerald-500/15 text-emerald-400 cursor-default"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
        onClick={doneState === "idle" ? sendDone : undefined}
        disabled={doneState !== "idle"}
        title={annotationCount === 0 ? "Approve and close" : "Send annotations back to Claude"}
      >
        {doneState === "idle" && (annotationCount === 0
          ? "Looks good"
          : `Send ${annotationCount} comment${annotationCount === 1 ? "" : "s"}`)}
        {doneState === "sending" && "Sending…"}
        {doneState === "sent" && (prefs.autoCloseAfterDone && countdown > 0
          ? `Sent — closing in ${countdown}s`
          : "Sent — you can close this tab")}
      </button>
      <button
        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        onClick={async () => {
          // Flush any debounced annotation save so the exported zip reflects
          // the user's latest edits, not the snapshot from 300ms ago.
          try { await onBeforeExport(); } catch (err) { console.error("Flush before export failed:", err); }
          const a = document.createElement("a");
          a.href = `/api/review/${reviewId}/export`;
          a.download = `${reviewId}.pinpoint.zip`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }}
        title="Export session as .pinpoint.zip"
        aria-label="Export session"
      >
        <DownloadIcon />
      </button>
      <button
        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        onClick={onShowHotkeys}
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
      >
        <QuestionIcon />
      </button>
      <button
        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors disabled:opacity-50 ${
          settingsOpen ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
        onClick={() => setSettingsOpen((v) => !v)}
        disabled={!prefsLoaded}
        title="Settings"
        aria-label="Settings"
      >
        <GearIcon />
      </button>
      <button
        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        onClick={onThemeToggle}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
      {settingsOpen && (
        <SettingsPopover
          prefs={prefs}
          onChange={onPrefsChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
