import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  /** Shrink-wraps the frame to its content instead of stretching to maxWidth — for content with its own intrinsic size (e.g. an image). */
  fitContent?: boolean;
}

export function Modal({ onClose, children, maxWidth = 440, fitContent = false }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portalled to <body> so a transformed ancestor (e.g. the popover's pop-in animation) can't trap this fixed overlay inside its bounds.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      style={{ backgroundColor: "rgba(0,0,0,.45)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className={`bg-surface rounded-[18px] border border-border shadow-token animate-pp-pop overflow-y-auto ${fitContent ? "" : "w-full"}`}
        style={{ maxWidth, maxHeight: "calc(100vh - 40px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
