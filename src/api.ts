import type { AnnotationAttachment, PinpointAnnotation, PinpointReview } from "./types.ts";

const REVIEW_PATH_RE = /\/review\/([a-zA-Z0-9_-]+)/;

export function reviewIdFromPath(pathname: string): string | null {
  return pathname.match(REVIEW_PATH_RE)?.[1] ?? null;
}

function url(path: string): string {
  return `${window.location.origin}${path}`;
}

export async function getReview(reviewId: string): Promise<PinpointReview> {
  const res = await fetch(url(`/api/review/${reviewId}`));
  if (!res.ok) throw new Error(`getReview failed: ${res.status}`);
  return res.json() as Promise<PinpointReview>;
}

export function imageUrl(reviewId: string, index: number): string {
  return url(`/api/review/${reviewId}/image?index=${index}`);
}

export async function saveAnnotations(
  reviewId: string,
  annotations: PinpointAnnotation[]
): Promise<void> {
  const res = await fetch(url(`/api/review/${reviewId}/annotations`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(annotations),
  });
  if (!res.ok) throw new Error(`saveAnnotations failed: ${res.status}`);
}

export function attachmentUrl(reviewId: string, attachmentId: string): string {
  return url(`/api/review/${reviewId}/attachments?id=${attachmentId}`);
}

export async function uploadAttachment(reviewId: string, blob: Blob): Promise<AnnotationAttachment> {
  const res = await fetch(url(`/api/review/${reviewId}/attachments`), {
    method: "POST",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) throw new Error(`uploadAttachment failed: ${res.status}`);
  return res.json() as Promise<AnnotationAttachment>;
}

export async function deleteAttachment(reviewId: string, attachmentId: string): Promise<void> {
  const res = await fetch(attachmentUrl(reviewId, attachmentId), { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteAttachment failed: ${res.status}`);
}

export async function finalizeReview(reviewId: string): Promise<void> {
  const res = await fetch(url(`/api/review/${reviewId}/finalize`), { method: "POST" });
  if (!res.ok) throw new Error(`finalizeReview failed: ${res.status}`);
}

export type ViewMode = "fit" | "actual";
export type CompareView = "split" | "single" | "stack";

export interface Preferences {
  autoCloseAfterDone: boolean;
  theme?: "dark" | "light";
  dismissedUpdateVersion?: string;
  viewMode: ViewMode;
  compareView: CompareView;
  idleReminder: boolean;
  idleReminderDelaySec: number;
}

export async function getPreferences(): Promise<Preferences> {
  const res = await fetch(url("/api/preferences"));
  if (!res.ok) throw new Error(`getPreferences failed: ${res.status}`);
  return res.json() as Promise<Preferences>;
}

export async function savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const res = await fetch(url("/api/preferences"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`savePreferences failed: ${res.status}`);
  return res.json() as Promise<Preferences>;
}
