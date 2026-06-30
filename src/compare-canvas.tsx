import type { PinpointAnnotation, CompareSlot } from "./types.ts";
import { CanvasLayer } from "./canvas-layer.tsx";
import { imageUrl } from "./api.ts";

export function CompareCanvas({
  activeSlot,
  reviewId,
  annotations,
  selectedId,
  justAddedId,
  compareView,
  activeSide,
  viewMode,
  onActiveSideChange,
  onBoxPlace,
  onSelect,
  onUpdate,
  onDelete,
}: {
  activeSlot: CompareSlot;
  reviewId: string;
  annotations: PinpointAnnotation[];
  selectedId: string | null;
  justAddedId: string | null;
  compareView: string;
  activeSide: "before" | "after";
  viewMode: "fit" | "actual";
  onActiveSideChange: (s: "before" | "after") => void;
  onBoxPlace: (x: number, y: number, w: number, h: number, imgIdx: number) => void;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<PinpointAnnotation>) => void;
  onDelete: (id: string) => void;
}) {
  const panes = [
    { label: "Before", imgIndex: activeSlot.beforeIndex },
    { label: "After",  imgIndex: activeSlot.afterIndex },
  ] as const;

  if (compareView === "split" || compareView === "stack") {
    return (
      <div className={`absolute inset-0 flex ${compareView === "stack" ? "flex-col" : "flex-row"}`}>
        {panes.map(({ label, imgIndex }, idx) => (
          <div
            key={label}
            className="flex-1 flex flex-col overflow-hidden relative"
            style={compareView === "split" && idx === 0
              ? { borderRight: "1px solid var(--border)" }
              : compareView === "stack" && idx === 0
              ? { borderBottom: "1px solid var(--border)" }
              : undefined}
          >
            <div
              className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-[11px] font-semibold text-white select-none pointer-events-none"
              style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            >
              {label}
            </div>
            <CanvasLayer
              imageDataUrl={imageUrl(reviewId, imgIndex)}
              annotations={annotations.filter((a) => a.imageIndex === imgIndex)}
              selectedId={selectedId}
              justAddedId={justAddedId}
              viewMode={viewMode}
              onBoxPlace={(x, y, w, h) => onBoxPlace(x, y, w, h, imgIndex)}
              onSelect={onSelect}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          </div>
        ))}
      </div>
    );
  }

  /* Switch mode — one pane at a time with tab toggle */
  const imgIndex = activeSide === "before" ? activeSlot.beforeIndex : activeSlot.afterIndex;
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex items-center justify-center gap-1 pt-2 pb-1 shrink-0">
        {(["before", "after"] as const).map((side) => (
          <button
            key={side}
            className="px-4 h-[28px] text-[12px] font-medium rounded-[7px] transition-all"
            style={activeSide === side ? {
              backgroundColor: "var(--accent)",
              color: "white",
            } : {
              backgroundColor: "var(--bg2)",
              color: "var(--muted)",
            }}
            onClick={() => onActiveSideChange(side)}
          >
            {side === "before" ? "Before" : "After"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        <CanvasLayer
          key={imgIndex}
          imageDataUrl={imageUrl(reviewId, imgIndex)}
          annotations={annotations.filter((a) => a.imageIndex === imgIndex)}
          selectedId={selectedId}
          justAddedId={justAddedId}
          viewMode={viewMode}
          onBoxPlace={(x, y, w, h) => onBoxPlace(x, y, w, h, imgIndex)}
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
