import { useCallback, useEffect, useRef, useState } from "react";
import type { PinpointAnnotation } from "./types.ts";
import { Popover } from "./popover.tsx";

interface CanvasLayerProps {
  imageDataUrl: string;
  annotations: PinpointAnnotation[];
  selectedId: string | null;
  onBoxPlace: (x: number, y: number, width: number, height: number) => void;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<PinpointAnnotation>) => void;
  onDelete: (id: string) => void;
}

const PIN_RADIUS = 14;
const HIT_RADIUS = 22;
const CLICK_BOX_SIZE = 6;

interface ImageLayout {
  drawW: number;
  drawH: number;
}

interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// For tall images (e.g. stitched mobile screenshots), fitting both axes
// squashes the width to an unusable strip. Detect extreme aspect ratios and
// fit just one axis so the other can scroll. Tall/wide branches cap at 1x to
// avoid blurry upscales of intentionally-large content; normal aspect ratios
// scale freely so small images still fill the viewport.
function getImageLayout(viewport: DOMRect, img: HTMLImageElement): ImageLayout {
  const viewportAspect = viewport.width / viewport.height;
  const imageAspect = img.width / img.height;

  let scale: number;
  if (imageAspect < viewportAspect * 0.5) {
    scale = Math.min(viewport.width / img.width, 1);
  } else if (imageAspect > viewportAspect * 2) {
    scale = Math.min(viewport.height / img.height, 1);
  } else {
    scale = Math.min(viewport.width / img.width, viewport.height / img.height);
  }
  return { drawW: Math.round(img.width * scale), drawH: Math.round(img.height * scale) };
}

export function CanvasLayer({
  imageDataUrl,
  annotations,
  selectedId,
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
    const next = getImageLayout(v.getBoundingClientRect(), img);
    setLayout((prev) => prev.drawW === next.drawW && prev.drawH === next.drawH ? prev : next);
  }, []);

  useEffect(() => { if (imgLoaded) computeLayout(); }, [imgLoaded, computeLayout]);
  useEffect(() => {
    const observer = new ResizeObserver(() => computeLayout());
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [computeLayout]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || layout.drawW === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = layout.drawW * dpr;
    canvas.height = layout.drawH * dpr;
    canvas.style.width = `${layout.drawW}px`;
    canvas.style.height = `${layout.drawH}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.drawImage(img, 0, 0, layout.drawW, layout.drawH);

    for (const ann of annotations) {
      const isSelected = ann.id === selectedId;

      const isRealBox = ann.box && (ann.box.width > CLICK_BOX_SIZE + 1 || ann.box.height > CLICK_BOX_SIZE + 1);
      if (isRealBox) {
        const bx = (ann.box!.x / 100) * layout.drawW;
        const by = (ann.box!.y / 100) * layout.drawH;
        const bw = (ann.box!.width / 100) * layout.drawW;
        const bh = (ann.box!.height / 100) * layout.drawH;
        ctx.strokeStyle = isSelected ? "#2563eb" : "#3b82f6";
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);
        ctx.fillStyle = isSelected ? "rgba(37,99,235,0.12)" : "rgba(59,130,246,0.06)";
        ctx.fillRect(bx, by, bw, bh);
      }

      const px = (ann.pin.x / 100) * layout.drawW;
      const py = (ann.pin.y / 100) * layout.drawH;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.arc(px, py, PIN_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#c73a30" : "#ea4a3e";
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(px, py, PIN_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(ann.number), px, py);
    }

    const drag = dragRef.current;
    if (drag) {
      const dx = Math.min(drag.startX, drag.currentX);
      const dy = Math.min(drag.startY, drag.currentY);
      const dw = Math.abs(drag.currentX - drag.startX);
      const dh = Math.abs(drag.currentY - drag.startY);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(dx, dy, dw, dh);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(59,130,246,0.08)";
      ctx.fillRect(dx, dy, dw, dh);
    }
  }, [annotations, selectedId, layout]);

  useEffect(() => { render(); });

  const localCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const hitTestPin = useCallback(
    (clientX: number, clientY: number): string | null => {
      if (layout.drawW === 0) return null;
      const local = localCoords(clientX, clientY);
      if (!local) return null;
      for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        const px = (ann.pin.x / 100) * layout.drawW;
        const py = (ann.pin.y / 100) * layout.drawH;
        if (Math.hypot(local.x - px, local.y - py) <= HIT_RADIUS) return ann.id;
      }
      return null;
    },
    [annotations, layout, localCoords]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const hitId = hitTestPin(e.clientX, e.clientY);
      if (hitId) { onSelect(hitId); return; }
      // If a popover is open, first click on empty canvas just closes it.
      if (selectedId) { onSelect(null); return; }
      const local = localCoords(e.clientX, e.clientY);
      if (!local) return;
      dragRef.current = { startX: local.x, startY: local.y, currentX: local.x, currentY: local.y };
      bumpDrag();
    },
    [hitTestPin, onSelect, selectedId, localCoords]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const local = localCoords(e.clientX, e.clientY);
    if (!local) return;
    dragRef.current.currentX = local.x;
    dragRef.current.currentY = local.y;
    bumpDrag();
  }, [localCoords]);

  const finalizeDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    bumpDrag();
    if (layout.drawW === 0) return;

    const toPct = (v: number, size: number) => (v / size) * 100;
    const x1 = toPct(Math.min(drag.startX, drag.currentX), layout.drawW);
    const y1 = toPct(Math.min(drag.startY, drag.currentY), layout.drawH);
    const x2 = toPct(Math.max(drag.startX, drag.currentX), layout.drawW);
    const y2 = toPct(Math.max(drag.startY, drag.currentY), layout.drawH);
    const w = x2 - x1;
    const h = y2 - y1;

    if (w < 2 && h < 2) {
      const midX = toPct((drag.startX + drag.currentX) / 2, layout.drawW);
      const midY = toPct((drag.startY + drag.currentY) / 2, layout.drawH);
      const bx = Math.max(0, midX - CLICK_BOX_SIZE / 2);
      const by = Math.max(0, midY - CLICK_BOX_SIZE / 2);
      onBoxPlace(bx, by, Math.min(CLICK_BOX_SIZE, 100 - bx), Math.min(CLICK_BOX_SIZE, 100 - by));
      return;
    }
    const cx = Math.max(0, x1);
    const cy = Math.max(0, y1);
    onBoxPlace(cx, cy, Math.min(100 - cx, w), Math.min(100 - cy, h));
  }, [layout, onBoxPlace]);

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
        className="absolute inset-0 overflow-auto"
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
          onMouseMove={handleMouseMove}
          onMouseUp={finalizeDrag}
          onMouseLeave={finalizeDrag}
        >
            <canvas ref={canvasRef} className="block" />

            {imgLoaded && selectedAnn && layout.drawW > 0 && (
              <Popover
                key={selectedAnn.id}
                annotation={selectedAnn}
                x={(selectedAnn.pin.x / 100) * layout.drawW + PIN_RADIUS + 8}
                y={(selectedAnn.pin.y / 100) * layout.drawH - 10}
                onUpdate={(updates) => onUpdate(selectedAnn.id, updates)}
                onDelete={() => onDelete(selectedAnn.id)}
                onClose={() => onSelect(null)}
              />
            )}
        </div>
      </div>
    </div>
  );
}
