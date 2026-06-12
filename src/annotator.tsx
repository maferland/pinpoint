import { useCallback, useEffect, useRef, useState } from "react";
import type { PinpointAnnotation, PinpointReview } from "./types.ts";
import { resolveSlots } from "./types.ts";
import type { Preferences } from "./api.ts";
import { Toolbar } from "./toolbar.tsx";
import { CanvasLayer } from "./canvas-layer.tsx";
import { UpdateBanner } from "./update-banner.tsx";
import { Thumbnail } from "./thumbnail.tsx";
import { DetailsPanel } from "./details-panel.tsx";
import { HotkeysHelp } from "./hotkeys-help.tsx";
import { useIdleReminder } from "./use-idle-reminder.ts";
import {
  getPreferences,
  getReview,
  imageUrl as buildImageUrl,
  reviewIdFromPath,
  saveAnnotations,
  savePreferences,
} from "./api.ts";

const DEFAULT_PREFS: Preferences = {
  autoCloseAfterDone: false,
  viewMode: "fit",
  idleReminder: false,
  idleReminderDelaySec: 60,
};

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || target.isContentEditable;
}

export function AnnotatorApp() {
  const reviewId = reviewIdFromPath(window.location.pathname);
  const [review, setReview] = useState<PinpointReview | null>(null);
  const [annotations, setAnnotations] = useState<PinpointAnnotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [detailsHidden, setDetailsHidden] = useState(false);
  const [hotkeysOpen, setHotkeysOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    if (!reviewId) return;
    getReview(reviewId)
      .then((data) => {
        setReview(data);
        setAnnotations(data.annotations);
      })
      .catch((err) => console.error("Failed to load review:", err));
  }, [reviewId]);

  useEffect(() => {
    let cancelled = false;
    getPreferences()
      .then((loaded) => { if (!cancelled) setPrefs({ ...DEFAULT_PREFS, ...loaded }); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPrefsLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const onPrefsChange = useCallback((patch: Partial<Preferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      savePreferences(patch).catch((err) => console.error("savePreferences failed:", err));
      return next;
    });
  }, []);

  useIdleReminder({
    enabled: prefs.idleReminder && prefsLoaded && !!review,
    delaySec: prefs.idleReminderDelaySec,
    paused: finalized,
  });

  const slots = review ? resolveSlots(review) : [];
  const activeSlot = slots[activeSlotIndex] ?? null;

  const currentImageUrl = review && activeSlot?.type === "single" && reviewId
    ? buildImageUrl(reviewId, activeSlot.imageIndex)
    : "";

  const activeAnnotations = activeSlot?.type === "single"
    ? annotations.filter((a) => a.imageIndex === activeSlot.imageIndex)
    : [];

  const pendingAnnotations = useRef<PinpointAnnotation[] | null>(null);
  const persistAnnotations = useCallback(
    (anns: PinpointAnnotation[]) => {
      if (!reviewId) return;
      pendingAnnotations.current = anns;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const snapshot = pendingAnnotations.current;
        pendingAnnotations.current = null;
        if (!snapshot) return;
        saveAnnotations(reviewId, snapshot).catch((err) =>
          console.error("Failed to save annotations:", err)
        );
      }, 300);
    },
    [reviewId]
  );

  const flushAnnotations = useCallback(async () => {
    if (!reviewId) return;
    clearTimeout(saveTimer.current);
    const snapshot = pendingAnnotations.current;
    pendingAnnotations.current = null;
    if (!snapshot) return;
    await saveAnnotations(reviewId, snapshot);
  }, [reviewId]);

  const addAnnotation = useCallback(
    (box: { x: number; y: number; width: number; height: number }, imageIndexOverride?: number) => {
      const fallbackIndex = activeSlot?.type === "single" ? activeSlot.imageIndex : 0;
      const ann: PinpointAnnotation = {
        id: crypto.randomUUID().slice(0, 12),
        number: annotations.length + 1,
        imageIndex: imageIndexOverride ?? fallbackIndex,
        pin: { x: box.x, y: box.y },
        box,
        comment: "",
      };
      const updated = [...annotations, ann];
      setAnnotations(updated);
      setSelectedId(ann.id);
      persistAnnotations(updated);
    },
    [annotations, activeSlot, persistAnnotations]
  );

  const updateAnnotation = useCallback(
    (id: string, updates: Partial<PinpointAnnotation>) => {
      const next = annotations.map((a) => (a.id === id ? { ...a, ...updates } : a));
      setAnnotations(next);
      persistAnnotations(next);
    },
    [annotations, persistAnnotations]
  );

  const removeAnnotation = useCallback(
    (id: string) => {
      const next = annotations
        .filter((a) => a.id !== id)
        .map((a, i) => ({ ...a, number: i + 1 }));
      setAnnotations(next);
      persistAnnotations(next);
      if (selectedId === id) setSelectedId(null);
    },
    [annotations, selectedId, persistAnnotations]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const editable = isEditableTarget(e.target);

      if (e.key === "Escape" && !editable) setSelectedId(null);

      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !editable) {
        removeAnnotation(selectedId);
      }

      if (e.key === "?" && !editable) { setHotkeysOpen((v) => !v); return; }

      // Arrow navigation is plain-arrow only — modifier combos (cmd/ctrl+arrow
      // for word/line jumps, shift for selection) stay native, and editable
      // targets always get to handle their own keys.
      if (editable || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      if (e.key === "ArrowLeft" && activeSlotIndex > 0) {
        setActiveSlotIndex((i) => i - 1);
        setSelectedId(null);
      }
      if (e.key === "ArrowRight" && activeSlotIndex < slots.length - 1) {
        setActiveSlotIndex((i) => i + 1);
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, activeSlotIndex, slots, removeAnnotation]);

  if (!reviewId) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-muted-foreground text-[13px]">
        No review ID in URL. Use create_review in Claude to start.
      </div>
    );
  }

  const activeImage = activeSlot?.type === "single"
    ? review?.images[activeSlot.imageIndex]
    : null;
  const activeDetails = activeImage?.details && Object.keys(activeImage.details).length > 0
    ? activeImage.details
    : null;
  const detailsVisible = !!activeDetails && !detailsHidden;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Toolbar
        reviewId={reviewId}
        annotationCount={annotations.length}
        context={review?.context}
        theme={theme}
        onThemeToggle={() => setTheme((t) => t === "dark" ? "light" : "dark")}
        prefs={prefs}
        prefsLoaded={prefsLoaded}
        onPrefsChange={onPrefsChange}
        onFinalized={() => setFinalized(true)}
        hasDetails={!!activeDetails}
        detailsVisible={detailsVisible}
        onToggleDetails={() => setDetailsHidden((v) => !v)}
        onShowHotkeys={() => setHotkeysOpen(true)}
        onBeforeExport={flushAnnotations}
      />

      {slots.length > 1 && reviewId && (
        <div className="h-16 flex items-center gap-2 px-4 bg-card border-b border-border shrink-0 overflow-x-auto">
          {slots.map((slot, si) => {
            const annCount = slot.type === "single"
              ? annotations.filter((a) => a.imageIndex === slot.imageIndex).length
              : annotations.filter((a) => a.imageIndex === slot.beforeIndex || a.imageIndex === slot.afterIndex).length;
            const img = review!.images[slot.type === "single" ? slot.imageIndex : slot.beforeIndex];
            return (
              <Thumbnail
                key={si}
                src={buildImageUrl(reviewId, slot.type === "single" ? slot.imageIndex : slot.beforeIndex)}
                srcAfter={slot.type === "compare" ? buildImageUrl(reviewId, slot.afterIndex) : undefined}
                index={si}
                active={si === activeSlotIndex}
                annotationCount={annCount}
                hasDetails={!!img?.details && Object.keys(img.details).length > 0}
                onClick={() => { setActiveSlotIndex(si); setSelectedId(null); }}
              />
            );
          })}
        </div>
      )}

      {activeSlot?.type === "compare" && reviewId ? (
        <div className="flex-1 overflow-hidden flex">
          {([
            { label: "Before", imgIndex: activeSlot.beforeIndex },
            { label: "After", imgIndex: activeSlot.afterIndex },
          ] as const).map(({ label, imgIndex }, idx) => (
            <div key={label} className="flex-1 flex flex-col overflow-hidden relative" style={idx === 0 ? { borderRight: "1px solid hsl(var(--border))" } : {}}>
              <div
                className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-[11px] font-semibold text-white select-none pointer-events-none"
                style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
              >
                {label}
              </div>
              <CanvasLayer
                imageDataUrl={buildImageUrl(reviewId, imgIndex)}
                annotations={annotations.filter((a) => a.imageIndex === imgIndex)}
                selectedId={selectedId}
                viewMode={prefs.viewMode}
                onBoxPlace={(x, y, w, h) => addAnnotation({ x, y, width: w, height: h }, imgIndex)}
                onSelect={setSelectedId}
                onUpdate={updateAnnotation}
                onDelete={removeAnnotation}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden flex">
          <CanvasLayer
            imageDataUrl={currentImageUrl}
            annotations={activeAnnotations}
            selectedId={selectedId}
            viewMode={prefs.viewMode}
            onBoxPlace={(x, y, w, h) => addAnnotation({ x, y, width: w, height: h })}
            onSelect={setSelectedId}
            onUpdate={updateAnnotation}
            onDelete={removeAnnotation}
          />
          {detailsVisible && activeDetails && (
            <DetailsPanel
              key={activeSlotIndex}
              details={activeDetails}
              imageLabel={slots.length > 1 ? `Image ${activeSlotIndex + 1}` : "Details"}
              onClose={() => setDetailsHidden(true)}
            />
          )}
        </div>
      )}

      <UpdateBanner />

      {hotkeysOpen && <HotkeysHelp onClose={() => setHotkeysOpen(false)} />}
    </div>
  );
}
