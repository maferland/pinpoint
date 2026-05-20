import { useCallback, useEffect, useRef, useState } from "react";

interface DetailsPanelProps {
  details: Record<string, string>;
  imageLabel: string;
  onClose: () => void;
}

const DEFAULT_POS = { x: 16, y: 16 };

export function DetailsPanel({ details, imageLabel, onClose }: DetailsPanelProps) {
  const [pos, setPos] = useState(DEFAULT_POS);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const root = rootRef.current;
      if (!root) return;
      const parent = root.parentElement;
      if (!parent) return;
      const pRect = parent.getBoundingClientRect();
      const next = {
        x: Math.max(0, Math.min(pRect.width - root.offsetWidth, e.clientX - pRect.left - drag.dx)),
        y: Math.max(0, Math.min(pRect.height - root.offsetHeight, e.clientY - pRect.top - drag.dy)),
      };
      setPos(next);
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const entries = Object.entries(details);

  return (
    <div
      ref={rootRef}
      className="absolute z-40 min-w-56 max-w-80 rounded-md border border-border bg-popover text-popover-foreground shadow-xl animate-fade-in"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onHeaderMouseDown}
      >
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <DragIcon />
          <span className="font-semibold uppercase tracking-wide">{imageLabel}</span>
        </div>
        <button
          className="w-5 h-5 -mr-1 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onClick={onClose}
          title="Hide details"
          aria-label="Hide details"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="px-2.5 py-1.5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground capitalize whitespace-nowrap">{key}</dt>
              <dd className="text-foreground break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

const DragIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
    <circle cx="3" cy="3" r="1" />
    <circle cx="3" cy="6" r="1" />
    <circle cx="3" cy="9" r="1" />
    <circle cx="9" cy="3" r="1" />
    <circle cx="9" cy="6" r="1" />
    <circle cx="9" cy="9" r="1" />
  </svg>
);

const CloseIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
