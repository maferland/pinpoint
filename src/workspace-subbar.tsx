import type { CompareView, ViewMode } from "./api.ts";
import { SegmentedControl } from "./ui/index.tsx";

interface WorkspaceSubbarProps {
  filename: string;
  isCompare: boolean;
  compareAvailable: boolean;
  compareView: CompareView;
  viewMode: ViewMode;
  onCompareViewChange: (v: CompareView) => void;
  onViewModeChange: (v: ViewMode) => void;
  onToggleCompare: () => void;
}

export function WorkspaceSubbar({
  filename,
  isCompare,
  compareAvailable,
  compareView,
  viewMode,
  onCompareViewChange,
  onViewModeChange,
  onToggleCompare,
}: WorkspaceSubbarProps) {
  return (
    <div
      className="flex items-center px-4 gap-3 bg-surface border-b border-border shrink-0"
      style={{ height: 50 }}
    >
      {/* Filename */}
      <p className="font-mono text-[12px] text-faint truncate flex-1 min-w-0">
        {filename}
        {isCompare && <span className="ml-1.5 text-faint">· before vs. after</span>}
      </p>

      <div className="flex items-center gap-2 shrink-0">
        {/* Orientation: only when compare is active */}
        {isCompare && (
          <SegmentedControl
            value={compareView}
            options={[
              { value: "split",  label: "Side" },
              { value: "stack",  label: "Stacked" },
              { value: "single", label: "Switch" },
            ] as { value: CompareView; label: string }[]}
            onChange={onCompareViewChange}
          />
        )}

        {/* Size mode: always visible */}
        <SegmentedControl
          value={viewMode}
          options={[
            { value: "fit",    label: "Fit" },
            { value: "actual", label: "Full size" },
          ] as { value: ViewMode; label: string }[]}
          onChange={onViewModeChange}
        />

        {/* Compare toggle: available when slot has a before/after pair */}
        {compareAvailable && (
          <button
            className="h-[28px] px-3 text-[12px] font-medium rounded-[8px] border transition-all select-none flex items-center gap-1.5"
            style={isCompare ? {
              backgroundColor: "var(--accent-soft)",
              borderColor: "var(--accent)",
              color: "var(--accent)",
            } : {
              backgroundColor: "var(--bg2)",
              borderColor: "var(--border)",
              color: "var(--muted)",
            }}
            onClick={onToggleCompare}
            title={isCompare ? "Exit compare mode" : "Show before/after comparison"}
          >
            <span
              className="w-[8px] h-[8px] rounded-full border transition-colors"
              style={{
                backgroundColor: isCompare ? "var(--accent)" : "transparent",
                borderColor: isCompare ? "var(--accent)" : "var(--muted)",
              }}
            />
            Compare
          </button>
        )}
      </div>
    </div>
  );
}
