import { useAttachmentSource } from "./attachment-source.ts";
import { Modal } from "./ui/modal.tsx";

interface AttachmentLightboxProps {
  reviewId: string;
  attachmentId: string;
  onClose: () => void;
}

export function AttachmentLightbox({ reviewId, attachmentId, onClose }: AttachmentLightboxProps) {
  const attachmentSource = useAttachmentSource();
  return (
    <Modal onClose={onClose} maxWidth={1200} fitContent>
      <div className="relative">
        <img
          src={attachmentSource.srcFor(reviewId, attachmentId)}
          alt="Pasted attachment, full size"
          className="block max-w-full rounded-[18px]"
          style={{ maxHeight: "calc(100vh - 40px)" }}
        />
        <button
          type="button"
          aria-label="Close"
          className="absolute top-3 right-3 w-[36px] h-[36px] rounded-full text-white text-[18px] leading-none flex items-center justify-center hover:bg-black/70 transition-colors"
          style={{ backgroundColor: "rgba(0,0,0,.6)" }}
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </Modal>
  );
}
