import { useCallback, useEffect, useRef, useState } from "react";
import type { PinpointAnnotation } from "./types.ts";
import type { ViewMode } from "./api.ts";
import { Popover } from "./popover.tsx";

interface CanvasLayerProps {
  imageDataUrl: string;
  annotations: PinpointAnnotation[];
  selectedId: string | null;
  viewMode: ViewMode;
  onBoxPlace: (x: number, y: number, width: number, height: number) => void;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<PinpointAnnotation>) => void;
  onDelete: (id: string) => void;
}

export const PIN_RADIUS = 14;
export const HIT_RADIUS = 22;
export const CLICK_BOX_SIZE = 6;
export const BOX_BORDER_HIT = 8;
// Conservative per-axis cap for canvas backing buffer. Safari tops out near
// 16384; going over silently truncates draws, leaving stitched-scroll captures
// rendering as blank. CSS size stays uncapped so scroll still covers the image.
export const MAX_CANVAS_DIM = 16384;

export interface ImageLayout {
  drawW: number;
  drawH: number;
}

interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface SizeXY { width: number; height: number; }

// "fit" scales to fill the viewport on the limiting axis (allowing upscale),
// so mobile screenshots stop drowning in letterbox. "actual" preserves native
// pixels: extreme aspects (stitched scrolls) get single-axis fit with scroll,
// and the scale is capped at 1x so retina screenshots aren't blurred up.
// Both modes route extreme aspects (stitched scrolls, panoramas) through
// single-axis fit — full-fit on an 85,000px-tall capture is a 4px sliver.
export function getImageLayout(viewport: SizeXY, img: SizeXY, mode: ViewMode): ImageLayout {
  const viewportAspect = viewport.width / viewport.height;
  const imageAspect = img.width / img.height;
  // Absolute, not viewport-relative: a wide window must not reclassify an
  // ordinary phone capture (~0.46) as a stitched scroll and override fit mode.
  const extremeTall = imageAspect < 0.2;
  const extremeWide = imageAspect > 5;
  let scale: number;
  if (extremeTall) {
    scale = Math.min(viewport.width / img.width, 1);
  } else if (extremeWide) {
    scale = Math.min(viewport.height / img.height, 1);
  } else if (mode === "fit") {
    scale = Math.min(viewport.width / img.width, viewport.height / img.height);
  } else if (imageAspect < viewportAspect * 0.5) {
    scale = Math.min(viewport.width / img.width, 1);
  } else if (imageAspect > viewportAspect * 2) {
    scale = Math.min(viewport.height / img.height, 1);
  } else {
    scale = Math.min(viewport.width / img.width, viewport.height / img.height);
  }
  return { drawW: Math.round(img.width * scale), drawH: Math.round(img.height * scale) };
}

/**
 * Pure hit-test against the annotation list at a canvas-local coordinate.
 * Pins take priority — they sit on top and are small. After pins, only the
 * box edges within BOX_BORDER_HIT of the dashed border count as hits, so a
 * wide box doesn't swallow the whole image.
 */
export function hitTestAnnotation(
  local: { x: number; y: number },
  annotations: PinpointAnnotation[],
  layout: ImageLayout
): string | null {
  if (layout.drawW === 0) return null;

  for (let i = annotations.length - 1; i >= 0; i--) {
    const ann = annotations[i];
    const px = (ann.pin.x / 100) * layout.drawW;
    const py = (ann.pin.y / 100) * layout.drawH;
    if (Math.hypot(local.x - px, local.y - py) <= HIT_RADIUS) return ann.id;
  }

  for (let i = annotations.length - 1; i >= 0; i--) {
    const ann = annotations[i];
    const isRealBox = ann.box && (ann.box.width > CLICK_BOX_SIZE + 1 || ann.box.height > CLICK_BOX_SIZE + 1);
    if (!isRealBox || !ann.box) continue;
    const bx = (ann.box.x / 100) * layout.drawW;
    const by = (ann.box.y / 100) * layout.drawH;
    const bw = (ann.box.width / 100) * layout.drawW;
    const bh = (ann.box.height / 100) * layout.drawH;
    const onLeft = Math.abs(local.x - bx) <= BOX_BORDER_HIT;
    const onRight = Math.abs(local.x - (bx + bw)) <= BOX_BORDER_HIT;
    const onTop = Math.abs(local.y - by) <= BOX_BORDER_HIT;
    const onBottom = Math.abs(local.y - (by + bh)) <= BOX_BORDER_HIT;
    const insideX = local.x >= bx - BOX_BORDER_HIT && local.x <= bx + bw + BOX_BORDER_HIT;
    const insideY = local.y >= by - BOX_BORDER_HIT && local.y <= by + bh + BOX_BORDER_HIT;
    if (((onLeft || onRight) && insideY) || ((onTop || onBottom) && insideX)) return ann.id;
  }
  return null;
}

export function CanvasLayer({
  imageDataUrl,
  annotations,
  selectedId,
  viewMode,
  onBoxPlace,
  onSelect,
  onUpdate,
  onDelete,
}: CanvasLayerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [layout, setLayout] = useState<ImageLayout>({ drawW: 0, drawH: 0 });
  const dragRef = useRef<DragState | null>(null);
  const [, setDragVersion] = useState(0);
  const bumpDrag = () => setDragVersion((v) => v + 1);
  const [scrollHints, setScrollHints] = useState({ up: false, down: false, left: false, right: false });

  useEffect(() => {
    if (!imageDataUrl) return;
    setImgLoaded(false);
    setImgError(false);
    setLayout({ drawW: 0, drawH: 0 });
    imgRef.current = null;
    const img = new Image();
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
    img.onerror = () => setImgError(true);
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  const computeLayout = useCallback(() => {
    const v = viewportRef.current;
    const img = imgRef.current;
    if (!v || !img) return;
    const next = getImageLayout(v.getBoundingClientRect(), img, viewMode);
    setLayout((prev) => prev.drawW === next.drawW && prev.drawH === next.drawH ? prev : next);
  }, [viewMode]);

  useEffect(() => { if (imgLoaded) computeLayout(); }, [imgLoaded, computeLayout]);
  useEffect(() => {
    const observer = new ResizeObserver(() => computeLayout());
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [computeLayout]);

  // Edge fade hints: appear only when the canvas extends past the viewport in
  // that direction, so an 85k-px stitched scroll obviously signals "more below".
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      setScrollHints({
        up: el.scrollTop > 1,
        down: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [layout]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || layout.drawW === 0) return;

    // Cap the backing buffer at MAX_CANVAS_DIM per axis so stitched-scroll
    // captures don't blow past Safari's ~16384 limit. CSS size is unchanged,
    // so scroll still covers the full image — the buffer just downsamples.
    const dprRaw = window.devicePixelRatio || 1;
    const dpr = Math.min(dprRaw, MAX_CANVAS_DIM / layout.drawW, MAX_CANVAS_DIM / layout.drawH);
    canvas.width = Math.floor(layout.drawW * dpr);
    canvas.height = Math.floor(layout.drawH * dpr);
    canvas.style.width = `${layout.drawW}px`;
    canvas.style.height = `${layout.drawH}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.drawImage(img, 0, 0, layout.drawW, layout.drawH);

    // Pins and boxes are rendered as DOM siblings below — when the canvas
    // buffer is downsampled for a stitched-scroll image, the browser keeps DOM
    // overlays at native resolution so pin numbers stay legible.

    const drag = dragRef.current;
    if (drag) {
      const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
      const sx = clamp(drag.startX, layout.drawW);
      const sy = clamp(drag.startY, layout.drawH);
      const ex = clamp(drag.currentX, layout.drawW);
      const ey = clamp(drag.currentY, layout.drawH);
      const dx = Math.min(sx, ex);
      const dy = Math.min(sy, ey);
      const dw = Math.abs(ex - sx);
      const dh = Math.abs(ey - sy);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(dx, dy, dw, dh);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(59,130,246,0.08)";
      ctx.fillRect(dx, dy, dw, dh);
    }
  }, [layout]);

  useEffect(() => { render(); });

  const localCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const hitTest = useCallback(
    (clientX: number, clientY: number): string | null => {
      const local = localCoords(clientX, clientY);
      if (!local) return null;
      return hitTestAnnotation(local, annotations, layout);
    },
    [annotations, layout, localCoords]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const hitId = hitTest(e.clientX, e.clientY);
      if (hitId) { onSelect(hitId); return; }
      // If a popover is open, first click on empty canvas just closes it.
      if (selectedId) { onSelect(null); return; }
      const local = localCoords(e.clientX, e.clientY);
      if (!local) return;
      dragRef.current = { startX: local.x, startY: local.y, currentX: local.x, currentY: local.y };
      bumpDrag();
    },
    [hitTest, onSelect, selectedId, localCoords]
  );

  const finalizeDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    bumpDrag();
    if (layout.drawW === 0) return;

    // Clamp drag endpoints to image bounds so a drag that leaves the canvas
    // still produces a box that stops at the edge instead of overshooting or
    // collapsing.
    const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
    const sx = clamp(drag.startX, layout.drawW);
    const sy = clamp(drag.startY, layout.drawH);
    const ex = clamp(drag.currentX, layout.drawW);
    const ey = clamp(drag.currentY, layout.drawH);

    const toPct = (v: number, size: number) => (v / size) * 100;
    const x1 = toPct(Math.min(sx, ex), layout.drawW);
    const y1 = toPct(Math.min(sy, ey), layout.drawH);
    const x2 = toPct(Math.max(sx, ex), layout.drawW);
    const y2 = toPct(Math.max(sy, ey), layout.drawH);
    const w = x2 - x1;
    const h = y2 - y1;

    if (w < 2 && h < 2) {
      const midX = toPct((sx + ex) / 2, layout.drawW);
      const midY = toPct((sy + ey) / 2, layout.drawH);
      const bx = Math.max(0, midX - CLICK_BOX_SIZE / 2);
      const by = Math.max(0, midY - CLICK_BOX_SIZE / 2);
      onBoxPlace(bx, by, Math.min(CLICK_BOX_SIZE, 100 - bx), Math.min(CLICK_BOX_SIZE, 100 - by));
      return;
    }
    onBoxPlace(x1, y1, w, h);
  }, [layout, onBoxPlace]);

  // Track drag at the window level so leaving the canvas (or releasing over
  // the popover/letterbox/toolbar) doesn't abandon the in-progress box.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const local = localCoords(e.clientX, e.clientY);
      if (!local) return;
      dragRef.current.currentX = local.x;
      dragRef.current.currentY = local.y;
      bumpDrag();
    };
    const onUp = () => {
      if (dragRef.current) finalizeDrag();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [localCoords, finalizeDrag]);

  // Letterbox clicks (outside the canvas) close any open popover.
  const handleViewportMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget) return;
      if (selectedId) onSelect(null);
    },
    [selectedId, onSelect]
  );

  if (!imageDataUrl || imgError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-muted-foreground text-[13px]">
        {imgError ? "Failed to load image" : "Waiting for screenshot..."}
      </div>
    );
  }

  const selectedAnn = selectedId ? annotations.find((a) => a.id === selectedId) : null;

  return (
    <div
      className="flex-1 relative overflow-hidden"
      style={{ backgroundColor: "hsl(var(--canvas-letterbox))" }}
    >
      <div
        ref={viewportRef}
        className="absolute inset-0 overflow-auto canvas-viewport"
        // `safe center` keeps the canvas centered when it fits but prevents
        // flex/grid centering from clipping the leading edge once it overflows.
        style={{ display: "grid", placeItems: "safe center" }}
        onMouseDown={handleViewportMouseDown}
      >
        <div
          className="relative cursor-crosshair"
          style={{
            width: layout.drawW || "100%",
            height: layout.drawH || "100%",
          }}
          onMouseDown={handleMouseDown}
        >
            <canvas ref={canvasRef} className="block" />

            {imgLoaded && layout.drawW > 0 && (
              <AnnotationOverlay annotations={annotations} selectedId={selectedId} />
            )}

            {imgLoaded && selectedAnn && layout.drawW > 0 && (() => {
              const POPOVER_W = 280;
              const pinPx = (selectedAnn.pin.x / 100) * layout.drawW;
              const popoverX = pinPx + PIN_RADIUS + 8 + POPOVER_W > layout.drawW
                ? Math.max(0, pinPx - PIN_RADIUS - 8 - POPOVER_W)
                : pinPx + PIN_RADIUS + 8;
              return (
                <Popover
                  key={selectedAnn.id}
                  annotation={selectedAnn}
                  x={popoverX}
                  y={(selectedAnn.pin.y / 100) * layout.drawH - 10}
                  onUpdate={(updates) => onUpdate(selectedAnn.id, updates)}
                  onDelete={() => onDelete(selectedAnn.id)}
                  onClose={() => onSelect(null)}
                />
              );
            })()}
        </div>
      </div>
      <ScrollHints hints={scrollHints} onScroll={(dir) => {
        const el = viewportRef.current;
        if (!el) return;
        const dy = el.clientHeight * 0.8;
        const dx = el.clientWidth * 0.8;
        const delta = {
          up: { top: -dy, left: 0 },
          down: { top: dy, left: 0 },
          left: { top: 0, left: -dx },
          right: { top: 0, left: dx },
        }[dir];
        el.scrollBy({ ...delta, behavior: "smooth" });
      }} />
    </div>
  );
}

type Dir = "up" | "down" | "left" | "right";

function ScrollHints({
  hints,
  onScroll,
}: {
  hints: Record<Dir, boolean>;
  onScroll: (dir: Dir) => void;
}) {
  const letterbox = "hsl(var(--canvas-letterbox))";
  // The fade strip stays click-through so it doesn't block pin placement near
  // the edges; the chevron button alone re-enables pointer events.
  return (
    <>
      {hints.up && (
        <div
          className="absolute inset-x-0 top-0 h-10 pointer-events-none flex items-start justify-center pt-1.5"
          style={{ background: `linear-gradient(to bottom, ${letterbox}, transparent)` }}
        >
          <ChevronButton direction="up" onClick={() => onScroll("up")} />
        </div>
      )}
      {hints.down && (
        <div
          className="absolute inset-x-0 bottom-0 h-10 pointer-events-none flex items-end justify-center pb-1.5"
          style={{ background: `linear-gradient(to top, ${letterbox}, transparent)` }}
        >
          <ChevronButton direction="down" onClick={() => onScroll("down")} />
        </div>
      )}
      {hints.left && (
        <div
          className="absolute inset-y-0 left-0 w-10 pointer-events-none flex items-center justify-start pl-1.5"
          style={{ background: `linear-gradient(to right, ${letterbox}, transparent)` }}
        >
          <ChevronButton direction="left" onClick={() => onScroll("left")} />
        </div>
      )}
      {hints.right && (
        <div
          className="absolute inset-y-0 right-0 w-10 pointer-events-none flex items-center justify-end pr-1.5"
          style={{ background: `linear-gradient(to left, ${letterbox}, transparent)` }}
        >
          <ChevronButton direction="right" onClick={() => onScroll("right")} />
        </div>
      )}
    </>
  );
}

function ChevronButton({ direction, onClick }: { direction: Dir; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label={`Scroll ${direction}`}
      className="pointer-events-auto rounded-full text-white/80 hover:text-white flex items-center justify-center transition-opacity opacity-60 hover:opacity-100 focus:outline-none"
      style={{
        width: 24,
        height: 24,
        backgroundColor: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <Chevron direction={direction} />
    </button>
  );
}

// DOM overlay for pins and boxes. Sits over the canvas with pointer-events
// disabled so clicks fall through to the canvas mouse handlers, which already
// hit-test annotations via hitTestAnnotation. Rendering as DOM keeps pin numbers
// crisp even when the canvas backing buffer is downsampled for huge images.
function AnnotationOverlay({
  annotations,
  selectedId,
}: {
  annotations: PinpointAnnotation[];
  selectedId: string | null;
}) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {annotations.map((ann) => {
        const isSelected = ann.id === selectedId;
        const isRealBox = ann.box && (ann.box.width > CLICK_BOX_SIZE + 1 || ann.box.height > CLICK_BOX_SIZE + 1);
        return (
          <div key={ann.id}>
            {isRealBox && ann.box && (
              <div
                className="absolute"
                style={{
                  left: `${ann.box.x}%`,
                  top: `${ann.box.y}%`,
                  width: `${ann.box.width}%`,
                  height: `${ann.box.height}%`,
                  border: `${isSelected ? 2.5 : 1.5}px dashed ${isSelected ? "#2563eb" : "#3b82f6"}`,
                  backgroundColor: isSelected ? "rgba(37,99,235,0.12)" : "rgba(59,130,246,0.06)",
                }}
              />
            )}
            <div
              className="absolute flex items-center justify-center font-bold text-white select-none"
              style={{
                left: `${ann.pin.x}%`,
                top: `${ann.pin.y}%`,
                width: PIN_RADIUS * 2,
                height: PIN_RADIUS * 2,
                marginLeft: -PIN_RADIUS,
                marginTop: -PIN_RADIUS,
                borderRadius: "50%",
                backgroundColor: isSelected ? "#c73a30" : "#ea4a3e",
                border: "2px solid white",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                fontSize: 11,
                fontFamily: "-apple-system, sans-serif",
              }}
            >
              {ann.number}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Chevron({ direction }: { direction: "up" | "down" | "left" | "right" }) {
  const rotation = { up: 180, down: 0, left: 90, right: -90 }[direction];
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
