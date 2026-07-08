import { createContext, useContext } from "react";
import { attachmentUrl } from "./api.ts";

// srcFor turns an attachment id into an <img> src; canEdit gates paste/remove. The annotator serves attachments over
// HTTP (default); the browser share-view has only decrypted bundle bytes, so it supplies blob URLs and is read-only.
export interface AttachmentSource {
  srcFor(reviewId: string, attachmentId: string): string;
  canEdit: boolean;
}

const httpAttachmentSource: AttachmentSource = {
  srcFor: (reviewId, attachmentId) => attachmentUrl(reviewId, attachmentId),
  canEdit: true,
};

export const AttachmentSourceContext = createContext<AttachmentSource>(httpAttachmentSource);

export function useAttachmentSource(): AttachmentSource {
  return useContext(AttachmentSourceContext);
}
