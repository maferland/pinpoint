import { useEffect, useRef } from "react";
import type { Preferences, ViewMode } from "./api.ts";

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
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
      className="absolute right-2 top-12 z-50 w-64 rounded-md border border-border bg-popover text-popover-foreground shadow-lg animate-fade-in"
    >
      <div className="px-3 py-2 border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Settings
      </div>

      <div className="px-3 py-2.5 flex flex-col gap-3 text-[12px]">
        <Row label="View" hint="How the screenshot fills the viewport">
          <Segmented
            value={prefs.viewMode}
            options={[{ value: "fit", label: "Fit" }, { value: "actual", label: "Actual" }]}
            onChange={(v) => onChange({ viewMode: v as ViewMode })}
          />
        </Row>

        <Toggle
          label="Auto-close tab"
          hint="Close this tab 3s after Done"
          checked={prefs.autoCloseAfterDone}
          onChange={(v) => onChange({ autoCloseAfterDone: v })}
        />

        <div className="flex flex-col gap-1.5">
          <Toggle
            label="Idle reminder"
            hint="Beep when the review has sat untouched"
            checked={prefs.idleReminder}
            onChange={(v) => onChange({ idleReminder: v })}
          />
          {prefs.idleReminder && (
            <div className="pl-0.5 flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">After</span>
              <select
                className="text-[11px] bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 border border-border"
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

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-foreground">{label}</span>
        {children}
      </div>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 cursor-pointer select-none">
      <div className="flex items-center justify-between gap-2">
        <span className="text-foreground">{label}</span>
        <input
          type="checkbox"
          className="accent-primary cursor-pointer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md bg-secondary p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
