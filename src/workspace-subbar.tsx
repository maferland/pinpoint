import type { CompareView, ViewMode } from "./api.ts";
import { SegmentedControl } from "./ui/index.tsx";

interface WorkspaceSubbarProps {
  filename: string;
  isCompare: boolean;
  compareView: CompareView;
  viewMode: ViewMode;
  onCompareViewChange: (v: CompareView) => void;
  onViewModeChange: (v: ViewMode) => void;
  /** When true, Fit and Full size render identically at the current viewport — hide the toggle. */
  viewModesEquivalent: boolean;
}

export function WorkspaceSubbar({
  filename,
  isCompare,
  compareView,
  viewMode,
  onCompareViewChange,
  onViewModeChange,
  viewModesEquivalent,
}: WorkspaceSubbarProps) {
  return (
    <div
      className="flex items-center px-4 gap-3 bg-surface border-b border-border shrink-0"
      style={{ height: 50 }}
    >
      <p className="font-mono text-[12px] text-faint truncate flex-1 min-w-0">
        {filename}
        {isCompare && <span className="ml-1.5 text-faint">· before vs. after</span>}
      </p>

      <div className="flex items-center gap-2 shrink-0">
        {isCompare && (
          <SegmentedControl
            value={compareView}
            options={[
              { value: "split",  label: "Side",    icon: <SideIcon /> },
              { value: "stack",  label: "Stacked", icon: <StackIcon /> },
              { value: "single", label: "Switch",  icon: <SwitchIcon /> },
            ] as { value: CompareView; label: string; icon: React.ReactNode }[]}
            onChange={onCompareViewChange}
          />
        )}

        {!viewModesEquivalent && (
          <SegmentedControl
            value={viewMode}
            options={[
              { value: "fit",    label: "Fit",       icon: <FitIcon /> },
              { value: "actual", label: "Full size",  icon: <FullIcon /> },
            ] as { value: ViewMode; label: string; icon: React.ReactNode }[]}
            onChange={onViewModeChange}
          />
        )}
      </div>
    </div>
  );
}

/* Icons match the spec exactly */

function SideIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="5" height="10" rx="1"/>
      <rect x="9" y="3" width="5" height="10" rx="1"/>
    </svg>
  );
}

function StackIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="2" width="10" height="5" rx="1"/>
      <rect x="3" y="9" width="10" height="5" rx="1"/>
    </svg>
  );
}

function SwitchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="3" width="12" height="10" rx="1.5"/>
      <path d="M2 6h12M5 4.5h.01"/>
    </svg>
  );
}

function FitIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 5.5V2.5h3M14 5.5V2.5h-3M2 10.5v3h3M14 10.5v3h-3"/>
    </svg>
  );
}

function FullIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6 2H2v4M14 6V2h-4M10 14h4v-4M2 10v4h4"/>
    </svg>
  );
}
