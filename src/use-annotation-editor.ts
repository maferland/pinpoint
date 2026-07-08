import { useCallback, useState } from "react";
import type { PinpointAnnotation } from "./types.ts";

interface UseAnnotationEditorOptions {
  resolveImageIndex?: (imageIndexOverride?: number) => number;
  onAdd?: (annotation: PinpointAnnotation) => void;
  onChange?: (annotations: PinpointAnnotation[]) => void;
}

export function useAnnotationEditor(initial: PinpointAnnotation[], options: UseAnnotationEditorOptions = {}) {
  const [annotations, setAnnotations] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { resolveImageIndex, onAdd, onChange } = options;

  const addAnnotation = useCallback(
    (box: { x: number; y: number; width: number; height: number }, imageIndexOverride?: number) => {
      const ann: PinpointAnnotation = {
        id: crypto.randomUUID().slice(0, 12),
        number: annotations.length + 1,
        imageIndex: resolveImageIndex ? resolveImageIndex(imageIndexOverride) : imageIndexOverride ?? 0,
        pin: { x: box.x, y: box.y },
        box,
        comment: "",
      };
      const updated = [...annotations, ann];
      setAnnotations(updated);
      setSelectedId(ann.id);
      onAdd?.(ann);
      onChange?.(updated);
    },
    [annotations, resolveImageIndex, onAdd, onChange]
  );

  const updateAnnotation = useCallback(
    (id: string, updates: Partial<PinpointAnnotation>) => {
      const next = annotations.map((a) => (a.id === id ? { ...a, ...updates } : a));
      setAnnotations(next);
      onChange?.(next);
    },
    [annotations, onChange]
  );

  const removeAnnotation = useCallback(
    (id: string) => {
      const next = annotations.filter((a) => a.id !== id).map((a, i) => ({ ...a, number: i + 1 }));
      setAnnotations(next);
      onChange?.(next);
      setSelectedId((current) => (current === id ? null : current));
    },
    [annotations, onChange]
  );

  return { annotations, setAnnotations, selectedId, setSelectedId, addAnnotation, updateAnnotation, removeAnnotation };
}
