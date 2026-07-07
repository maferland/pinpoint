import { useCallback, useEffect, useRef, useState } from "react";
import type { PinpointAnnotation, PinpointReview } from "./types.ts";
import { resolveSlots } from "./types.ts";
import type { Preferences } from "./api.ts";
import { Toolbar } from "./toolbar.tsx";
import { WorkspaceSubbar } from "./workspace-subbar.tsx";
import { CanvasLayer } from "./canvas-layer.tsx";
import { CompareCanvas } from "./compare-canvas.tsx";
import { CommentsRail } from "./comments-rail.tsx";
import { Thumbnail } from "./thumbnail.tsx";
import { Toast } from "./toast.tsx";
import { HelpModal } from "./help-modal.tsx";
import { UpdateBanner } from "./update-banner.tsx";
import { useIdleReminder } from "./use-idle-reminder.ts";
import { useKeyPress } from "./use-key-press.ts";
import {
  getPreferences,
  getReview,
  imageUrl,
  reviewIdFromPath,
  saveAnnotations,
  savePreferences,
} from "./api.ts";

const DEFAULT_PREFS: Preferences = {
  autoCloseAfterDone: false,
  viewMode: "fit",
  compareView: "split",
  idleReminder: false,
  idleReminderDelaySec: 60,
};

export function AnnotatorApp() {
  const reviewId = reviewIdFromPath(window.location.pathname);
  const [review, setReview] = useState<PinpointReview | null>(null);
  const [annotations, setAnnotations] = useState<PinpointAnnotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [viewModesEquivalent, setViewModesEquivalent] = useState(false);
  const [activeSide, setActiveSide] = useState<"before" | "after">("before");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const justAddedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(justAddedTimer.current), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!reviewId) return;
    getReview(reviewId)
      .then((data) => { setReview(data); setAnnotations(data.annotations); })
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
  const compareView = prefs.compareView ?? "split";

  useEffect(() => { setActiveSide("before"); setViewModesEquivalent(false); }, [activeSlotIndex]);

  const activeFilename = (() => {
    if (!activeSlot || !review) return undefined;
    if (activeSlot.type === "single") return review.images[activeSlot.imageIndex]?.path?.split("/").pop();
    return review.images[activeSlot.beforeIndex]?.path?.split("/").pop();
  })();

  const currentImageUrl = review && activeSlot?.type === "single" && reviewId
    ? imageUrl(reviewId, activeSlot.imageIndex)
    : "";

  const activeAnnotations = !activeSlot
    ? []
    : activeSlot.type === "single"
    ? annotations.filter((a) => a.imageIndex === activeSlot.imageIndex)
    : annotations.filter(
        (a) => a.imageIndex === activeSlot.beforeIndex || a.imageIndex === activeSlot.afterIndex
      );

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
      setJustAddedId(ann.id);
      clearTimeout(justAddedTimer.current);
      justAddedTimer.current = setTimeout(() => setJustAddedId(null), 400);
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

  useKeyPress("Escape", () => setSelectedId(null));
  useKeyPress(["Delete", "Backspace"], () => removeAnnotation(selectedId!), { when: !!selectedId });
  useKeyPress("?", () => setShowHelp((v) => !v));
  useKeyPress("Tab", (e) => { e.preventDefault(); setActiveSide((s) => s === "before" ? "after" : "before"); }, {
    when: activeSlot?.type === "compare" && compareView === "single",
  });
  useKeyPress("ArrowLeft", () => { setActiveSlotIndex((i) => i - 1); setSelectedId(null); }, {
    when: activeSlotIndex > 0, modifiers: false,
  });
  useKeyPress("ArrowRight", () => { setActiveSlotIndex((i) => i + 1); setSelectedId(null); }, {
    when: activeSlotIndex < slots.length - 1, modifiers: false,
  });

  if (!reviewId) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg text-muted text-[13px]">
        No review ID in URL. Use create_review in Claude to start.
      </div>
    );
  }

  const isCompare = activeSlot?.type === "compare";

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      <Toolbar
        reviewId={reviewId}
        annotationCount={annotations.length}
        context={review?.context}
        activeFilename={activeFilename}
        theme={theme}
        onThemeToggle={() => setTheme((t) => t === "dark" ? "light" : "dark")}
        prefs={prefs}
        prefsLoaded={prefsLoaded}
        onPrefsChange={onPrefsChange}
        onFinalized={() => setFinalized(true)}
        onShowHelp={() => setShowHelp(true)}
        onToast={setToast}
        onBeforeExport={flushAnnotations}
      />

      <WorkspaceSubbar
        filename={activeFilename ?? ""}
        isCompare={isCompare}
        compareView={compareView}
        viewMode={prefs.viewMode}
        onCompareViewChange={(v) => onPrefsChange({ compareView: v })}
        onViewModeChange={(v) => onPrefsChange({ viewMode: v })}
        viewModesEquivalent={viewModesEquivalent}
      />

      {/* Main content: canvas + rail */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area + filmstrip column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Canvas wrapper — relative anchors CompareCanvas's absolute inset-0; flex-col lets CanvasLayer's flex-1 root grow */}
          <div className="flex-1 relative flex flex-col overflow-hidden">
          {activeSlot?.type === "compare" && reviewId ? (
            <CompareCanvas
              activeSlot={activeSlot}
              reviewId={reviewId}
              annotations={annotations}
              selectedId={selectedId}
              justAddedId={justAddedId}
              compareView={compareView}
              activeSide={activeSide}
              viewMode={prefs.viewMode}
              onActiveSideChange={setActiveSide}
              onBoxPlace={(x, y, w, h, imgIdx) => addAnnotation({ x, y, width: w, height: h }, imgIdx)}
              onSelect={setSelectedId}
              onUpdate={updateAnnotation}
              onDelete={removeAnnotation}
            />
          ) : (
            <CanvasLayer
              reviewId={reviewId ?? ""}
              imageDataUrl={currentImageUrl}
              annotations={activeAnnotations}
              selectedId={selectedId}
              justAddedId={justAddedId}
              viewMode={prefs.viewMode}
              onBoxPlace={(x, y, w, h) => addAnnotation({ x, y, width: w, height: h })}
              onSelect={setSelectedId}
              onUpdate={updateAnnotation}
              onDelete={removeAnnotation}
              onViewModesEquivalent={setViewModesEquivalent}
            />
          )}
          </div>

          {/* Filmstrip — always at the bottom, outside the canvas wrapper */}
          {slots.length > 1 && reviewId && (
            <div
              className="flex items-center gap-3 px-4 bg-surface border-t border-border shrink-0 overflow-x-auto"
              style={{ height: 102 }}
            >
              <span className="font-mono text-[10px] font-semibold text-faint tracking-widest uppercase shrink-0">
                Screens
              </span>
              {slots.map((slot, si) => {
                const annCount = slot.type === "single"
                  ? annotations.filter((a) => a.imageIndex === slot.imageIndex).length
                  : annotations.filter((a) => a.imageIndex === slot.beforeIndex || a.imageIndex === slot.afterIndex).length;
                const img = review!.images[slot.type === "single" ? slot.imageIndex : slot.beforeIndex];
                return (
                  <Thumbnail
                    key={si}
                    src={imageUrl(reviewId, slot.type === "single" ? slot.imageIndex : slot.beforeIndex)}
                    srcAfter={slot.type === "compare" ? imageUrl(reviewId, slot.afterIndex) : undefined}
                    filename={img?.path}
                    index={si}
                    active={si === activeSlotIndex}
                    annotationCount={annCount}
                    onClick={() => { setActiveSlotIndex(si); setSelectedId(null); }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Comments rail */}
        <CommentsRail
          reviewId={reviewId}
          annotations={activeAnnotations}
          selectedId={selectedId}
          context={review?.context}
          onSelect={(id) => { setSelectedId(id); }}
        />
      </div>

      <UpdateBanner />

      {/* Overlays */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}


