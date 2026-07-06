import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PinpointAnnotation } from "./types.ts";

interface PopoverProps {
  annotation: PinpointAnnotation;
  x: number;
  y: number;
  onUpdate: (updates: Partial<PinpointAnnotation>) => void;
  onDelete: () => void;
  onClose: () => void;
}

function useFlushSave(
  draft: string,
  committed: string,
  onUpdate: (updates: Partial<PinpointAnnotation>) => void,
  onDelete: () => void
) {
  const draftRef = useRef(draft);
  const committedRef = useRef(committed);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  const cancelRef = useRef(false);
  useLayoutEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { committedRef.current = committed; }, [committed]);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);

  const flush = useCallback(() => {
    if (cancelRef.current) return;
    if (draftRef.current !== committedRef.current) {
      onUpdateRef.current({ comment: draftRef.current });
      committedRef.current = draftRef.current;
    }
  }, []);

  const cancel = useCallback(() => { cancelRef.current = true; }, []);

  useEffect(() => () => {
    if (cancelRef.current) return; // Escape: revert, never delete — the annotation stays exactly as last committed.
    flush();
    if (draftRef.current.trim() === "") onDeleteRef.current();
  }, [flush]);

  return { flush, cancel };
}

export function Popover({ annotation, x, y, onUpdate, onDelete, onClose }: PopoverProps) {
  const [comment, setComment] = useState(annotation.comment);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNew = !annotation.comment;
  const { flush, cancel } = useFlushSave(comment, annotation.comment, onUpdate, onDelete);
  const isBox = annotation.box && (annotation.box.width > 7 || annotation.box.height > 7);

  useEffect(() => { setComment(annotation.comment); }, [annotation.comment]);
  useEffect(() => { if (isNew) textareaRef.current?.focus(); }, [isNew]);
  useEffect(() => {
    const timer = setTimeout(flush, 400);
    return () => clearTimeout(timer);
  }, [comment, flush]);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [comment]);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      const container = e.currentTarget.closest("[data-popover]");
      if (container?.contains(e.relatedTarget as Node)) return;
      flush();
    },
    [flush]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        flush();
        onClose();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        setComment(annotation.comment);
        onClose();
      }
    },
    [flush, cancel, annotation.comment, onClose]
  );

  return (
    <div
      className="absolute z-50 animate-pp-pop"
      style={{ left: x, top: y, width: 300 }}
      data-popover
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="rounded-[12px] border border-border overflow-hidden"
        style={{
          backgroundColor: "var(--surface)",
          boxShadow: "var(--shadow)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <span
            className="w-[20px] h-[20px] flex items-center justify-center text-[10px] font-bold text-white rounded-full shrink-0"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {annotation.number}
          </span>
          <span className="font-mono text-[10px] font-semibold text-faint tracking-wider uppercase">
            {isBox ? "Region" : "Pin"}
          </span>
        </div>

        {/* Textarea */}
        <div className="px-3 pt-2.5 pb-2">
          <textarea
            ref={textareaRef}
            data-testid="popover-textarea"
            className="w-full bg-transparent text-[13px] text-txt placeholder:text-faint resize-none outline-none leading-relaxed"
            style={{ minHeight: 74 }}
            placeholder="Describe what to change…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center px-3 pb-2.5 gap-2">
          <button
            className="text-[12px] text-faint hover:text-accent transition-colors"
            onClick={onDelete}
          >
            Delete
          </button>
          <div className="flex-1" />
          <button
            className="flex items-center gap-1.5 text-[12px] font-medium text-accent hover:opacity-80 transition-opacity"
            onClick={() => { flush(); onClose(); }}
          >
            Save
            <span className="text-[10px] text-faint font-normal opacity-60">⌘↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}
