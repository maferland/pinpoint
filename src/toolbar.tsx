import { useEffect, useState } from "react";
import { finalizeReview } from "./api.ts";
import type { Preferences } from "./api.ts";
import { IconButton, Button } from "./ui/index.tsx";
import { SettingsPopover } from "./settings-popover.tsx";
import { parseContext } from "./context.ts";

interface ToolbarProps {
  reviewId: string;
  annotationCount: number;
  context?: string;
  activeFilename?: string;
  theme: "dark" | "light";
  onThemeToggle: () => void;
  prefs: Preferences;
  onFinalized: () => void;
  onShowWelcome: () => void;
  onShowShare: () => void;
  prefsLoaded: boolean;
  onPrefsChange: (patch: Partial<Preferences>) => void;
  onToast: (msg: string) => void;
  onBeforeExport: () => Promise<void>;
}

export function Toolbar({
  reviewId,
  annotationCount,
  context,
  activeFilename,
  theme,
  onThemeToggle,
  prefs,
  onFinalized,
  onShowWelcome,
  onShowShare,
  onToast,
  onBeforeExport,
  prefsLoaded,
  onPrefsChange,
}: ToolbarProps) {
  const [doneState, setDoneState] = useState<"idle" | "sending" | "sent">("idle");
  const [countdown, setCountdown] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (doneState !== "sent" || !prefs.autoCloseAfterDone) return;
    setCountdown(3);
    const tick = setInterval(() => setCountdown((n) => (n > 0 ? n - 1 : 0)), 1000);
    const close = setTimeout(() => window.close(), 3000);
    return () => { clearInterval(tick); clearTimeout(close); };
  }, [doneState, prefs.autoCloseAfterDone]);

  const sendDone = async () => {
    setDoneState("sending");
    try {
      await onBeforeExport();
      await finalizeReview(reviewId);
      setDoneState("sent");
      onFinalized();
      onToast(annotationCount === 0
        ? "Looks good — control returned to the agent."
        : `Sent ${annotationCount} comment${annotationCount === 1 ? "" : "s"} — the agent is working through them…`);
    } catch (err) {
      console.error("Finalize failed:", err);
      setDoneState("idle");
    }
  };

  const handleExport = async () => {
    try { await onBeforeExport(); } catch (err) { console.error("Flush before export:", err); }
    const a = document.createElement("a");
    a.href = `/api/review/${reviewId}/export`;
    a.download = `${reviewId}.pinpoint.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    onToast(`Exported ${reviewId}.pinpoint.zip → Downloads`);
  };

  const reviewShort = reviewId.slice(0, 7);

  const ctx = parseContext(context);
  const displayTitle: string = ctx?.message ?? activeFilename ?? "Review";

  return (
    <div
      className="flex items-center px-4 gap-2 bg-surface border-b border-border shrink-0 select-none"
      style={{ height: 56 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="rounded-full shrink-0"
          style={{
            width: 11, height: 11,
            backgroundColor: "var(--accent)",
            boxShadow: "0 0 0 3px var(--accent-soft)",
          }}
        />
        <span className="font-mono text-[13px] font-semibold text-txt tracking-tight">
          pinpoint
        </span>
      </div>

      <Divider />

      {/* Context block */}
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <p className="text-[13px] font-medium text-txt truncate leading-tight">
          {displayTitle}
        </p>
        <p className="font-mono text-[11px] text-faint truncate leading-tight">
          {reviewShort}{activeFilename ? ` · ${activeFilename}` : ""}
        </p>
      </div>

      {/* Interaction hints pill */}
      <div
        className="hidden md:flex items-center gap-3 px-3 h-[30px] rounded-[8px] border border-border bg-bg shrink-0"
        aria-hidden
      >
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <TargetIcon /> Click to pin
        </span>
        <span className="text-faint text-[10px]">│</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <DragBoxIcon /> Drag to box
        </span>
      </div>

      {/* Action buttons */}
      <IconButton onClick={onShowWelcome} title="How it works (?)" aria-label="Help">
        <QuestionIcon />
      </IconButton>

      <IconButton onClick={onThemeToggle} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </IconButton>

      <div className="relative">
        <IconButton
          active={settingsOpen}
          onClick={() => setSettingsOpen((v) => !v)}
          disabled={!prefsLoaded}
          title="Settings"
          aria-label="Settings"
        >
          <GearIcon />
        </IconButton>
        {settingsOpen && (
          <SettingsPopover
            prefs={prefs}
            onChange={onPrefsChange}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>

      <IconButton onClick={handleExport} title="Export .pinpoint.zip" aria-label="Export session">
        <DownloadIcon />
      </IconButton>

      {/* Share with annotation count badge */}
      <div className="relative">
        <IconButton onClick={onShowShare} title="Share" aria-label="Share review">
          <ShareIcon />
        </IconButton>
        {annotationCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center font-mono text-[9px] font-bold text-white rounded-full pointer-events-none"
            style={{ backgroundColor: "var(--accent)", padding: "0 3px" }}
          >
            {annotationCount}
          </span>
        )}
      </div>

      <Divider />

      {/* Send / Looks good */}
      {doneState === "idle" && (
        <Button
          variant={annotationCount === 0 ? "good" : "accent"}
          size="md"
          onClick={sendDone}
          title={annotationCount === 0 ? "Approve and return to agent" : "Send feedback to agent"}
        >
          {annotationCount === 0 ? (
            <>
              <CheckIcon />
              Looks good
            </>
          ) : (
            <>
              <PlaneIcon />
              {`Send ${annotationCount} comment${annotationCount === 1 ? "" : "s"}`}
            </>
          )}
        </Button>
      )}
      {doneState === "sending" && (
        <Button variant="ghost" size="md" disabled>Sending…</Button>
      )}
      {doneState === "sent" && (
        <Button variant="ghost" size="md" disabled>
          {prefs.autoCloseAfterDone && countdown > 0
            ? `Sent — closing in ${countdown}s`
            : "Sent — you can close this tab"}
        </Button>
      )}
    </div>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border shrink-0" />;
}

/* ── Icons ───────────────────────────────────────────────────────────── */

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PlaneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function DragBoxIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}
