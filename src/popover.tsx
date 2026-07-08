import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AnnotationAttachment, PinpointAnnotation } from "./types.ts";
import { deleteAttachment, uploadAttachment } from "./api.ts";
import { useAttachmentSource } from "./attachment-source.ts";
import { AttachmentLightbox } from "./attachment-lightbox.tsx";

interface PopoverProps {
  reviewId: string;
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
  hasAttachments: boolean,
  onUpdate: (updates: Partial<PinpointAnnotation>) => void,
  onDelete: () => void
) {
  const draftRef = useRef(draft);
  const committedRef = useRef(committed);
  const hasAttachmentsRef = useRef(hasAttachments);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  const cancelRef = useRef(false);
  useLayoutEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { committedRef.current = committed; }, [committed]);
  useLayoutEffect(() => { hasAttachmentsRef.current = hasAttachments; }, [hasAttachments]);
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
    if (cancelRef.current) {
      // Escape: discard the draft. Only clean up if nothing was ever committed —
      // an annotation with real saved content (text or a pasted image) is never deleted by Escape.
      if (committedRef.current.trim() === "" && !hasAttachmentsRef.current) onDeleteRef.current();
      return;
    }
    flush();
    if (draftRef.current.trim() === "" && !hasAttachmentsRef.current) onDeleteRef.current();
  }, [flush]);

  return { flush, cancel };
}

interface PendingUpload {
  previewUrl: string;
}

export function Popover({ reviewId, annotation, x, y, onUpdate, onDelete, onClose }: PopoverProps) {
  const [comment, setComment] = useState(annotation.comment);
  const [attachments, setAttachments] = useState<AnnotationAttachment[]>(annotation.attachments ?? []);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const attachmentSource = useAttachmentSource();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNew = !annotation.comment;
  const { flush, cancel } = useFlushSave(
    comment,
    annotation.comment,
    attachments.length > 0,
    onUpdate,
    onDelete
  );
  const isBox = annotation.box && (annotation.box.width > 7 || annotation.box.height > 7);

  useEffect(() => { setComment(annotation.comment); }, [annotation.comment]);
  useEffect(() => { setAttachments(annotation.attachments ?? []); }, [annotation.attachments]);
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

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!attachmentSource.canEdit) return;
      const imageItems = Array.from(e.clipboardData.items).filter((item) => item.type.startsWith("image/"));
      if (imageItems.length === 0) return;
      e.preventDefault();

      for (const item of imageItems) {
        const blob = item.getAsFile();
        if (!blob) continue;
        const previewUrl = URL.createObjectURL(blob);
        setPendingUploads((prev) => [...prev, { previewUrl }]);

        uploadAttachment(reviewId, blob)
          .then((attachment) => {
            setPendingUploads((prev) => prev.filter((p) => p.previewUrl !== previewUrl));
            URL.revokeObjectURL(previewUrl);
            setAttachments((prev) => {
              const next = [...prev, attachment];
              onUpdate({ attachments: next });
              return next;
            });
          })
          .catch(() => {
            setPendingUploads((prev) => prev.filter((p) => p.previewUrl !== previewUrl));
            URL.revokeObjectURL(previewUrl);
          });
      }
    },
    [reviewId, onUpdate, attachmentSource.canEdit]
  );

  const handleRemoveAttachment = useCallback(
    (attachmentId: string) => {
      setAttachments((prev) => {
        const next = prev.filter((a) => a.id !== attachmentId);
        onUpdate({ attachments: next });
        return next;
      });
      deleteAttachment(reviewId, attachmentId).catch(() => {});
    },
    [reviewId, onUpdate]
  );

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
        <div className="px-3 pt-2.5 pb-0">
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
            onPaste={handlePaste}
          />
        </div>

        {/* Attachment chips — pasted images shown below the textarea, Slack-composer style */}
        {(attachments.length > 0 || pendingUploads.length > 0) && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-0.5 pb-2.5">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="relative group shrink-0" style={{ width: 56, height: 56 }}>
                <button
                  type="button"
                  aria-label="View attachment full size"
                  className="w-full h-full block cursor-zoom-in"
                  onClick={() => setLightboxId(attachment.id)}
                >
                  <img
                    src={attachmentSource.srcFor(reviewId, attachment.id)}
                    alt="Pasted attachment"
                    className="w-full h-full object-cover rounded-[6px] border border-border"
                  />
                </button>
                {attachmentSource.canEdit && (
                  <button
                    type="button"
                    aria-label="Remove attachment"
                    className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full text-white text-[11px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: "var(--accent)" }}
                    onClick={(e) => { e.stopPropagation(); handleRemoveAttachment(attachment.id); }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {pendingUploads.map((pending) => (
              <img
                key={pending.previewUrl}
                src={pending.previewUrl}
                alt="Uploading attachment"
                className="shrink-0 object-cover rounded-[6px] border border-border animate-pulse"
                style={{ width: 56, height: 56, opacity: 0.6 }}
              />
            ))}
          </div>
        )}

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

      {lightboxId && (
        <AttachmentLightbox
          reviewId={reviewId}
          attachmentId={lightboxId}
          onClose={() => setLightboxId(null)}
        />
      )}
    </div>
  );
}
