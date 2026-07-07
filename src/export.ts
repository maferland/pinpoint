import fs from "fs";
import path from "path";
import type { AnnotationAttachment, ImageInfo, PinpointAnnotation, PinpointReview } from "./types.js";
import { generateId } from "./util.js";
import { readZip, writeZip, type ZipEntry } from "./zip.js";
import type { FileReviewStore } from "./store.js";

const MANIFEST_NAME = "review.json";
const IMAGE_PREFIX = "images/";
const ATTACHMENT_PREFIX = "attachments/";

export interface BundleImage {
  name: string;
  mime: string;
  width: number;
  height: number;
  details?: Record<string, string>;
}

/**
 * Manifest stored as review.json inside the zip. Image bytes live at
 * `images/<index>-<name>` and are referenced by index here.
 */
export interface BundleManifest {
  kind: "pinpoint-export";
  version: "1.0";
  exportedAt: string;
  id: string;
  context?: string;
  createdAt: string;
  annotations: PinpointAnnotation[];
  images: BundleImage[];
}

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function mimeFor(filename: string): string {
  return MIME_BY_EXT[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
}

function safeFilename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function serialize(review: PinpointReview, store: FileReviewStore): Promise<Buffer> {
  const images: BundleImage[] = [];
  const imageEntries: ZipEntry[] = [];

  for (let i = 0; i < review.images.length; i++) {
    const img = review.images[i];
    const safeName = safeFilename(path.basename(img.path)) || `image-${i}.bin`;
    const zipName = `${IMAGE_PREFIX}${i}-${safeName}`;
    imageEntries.push({ name: zipName, data: await fs.promises.readFile(img.path) });
    images.push({
      name: zipName,
      mime: mimeFor(img.path),
      width: img.width,
      height: img.height,
      ...(img.details ? { details: img.details } : {}),
    });
  }

  const attachmentEntries: ZipEntry[] = [];
  for (const ann of review.annotations) {
    for (const attachment of ann.attachments ?? []) {
      const bytes = await fs.promises.readFile(store.attachmentPath(review.id, attachment.id));
      attachmentEntries.push({ name: `${ATTACHMENT_PREFIX}${ann.id}-${attachment.id}`, data: bytes });
    }
  }

  const manifest: BundleManifest = {
    kind: "pinpoint-export",
    version: "1.0",
    exportedAt: new Date().toISOString(),
    id: review.id,
    context: review.context,
    createdAt: review.createdAt,
    annotations: review.annotations,
    images,
  };

  return writeZip([
    { name: MANIFEST_NAME, data: Buffer.from(JSON.stringify(manifest, null, 2), "utf-8") },
    ...imageEntries,
    ...attachmentEntries,
  ]);
}

function isManifest(value: unknown): value is BundleManifest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.kind === "pinpoint-export" && v.version === "1.0" && Array.isArray(v.images) && Array.isArray(v.annotations);
}

export interface ParsedBundle {
  manifest: BundleManifest;
  imageBytes: Map<string, Buffer>;
}

export function parseBundle(buf: Buffer): ParsedBundle {
  let entries: ZipEntry[];
  try {
    entries = readZip(buf);
  } catch (err) {
    throw new Error(`Bundle is not a valid zip: ${err instanceof Error ? err.message : err}`);
  }

  const manifestEntry = entries.find((e) => e.name === MANIFEST_NAME);
  if (!manifestEntry) throw new Error(`Bundle missing ${MANIFEST_NAME}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestEntry.data.toString("utf-8"));
  } catch {
    throw new Error(`${MANIFEST_NAME} is not valid JSON`);
  }
  if (!isManifest(parsed)) throw new Error("Not a pinpoint-export v1.0 bundle");

  const imageBytes = new Map<string, Buffer>();
  for (const entry of entries) {
    if (entry.name === MANIFEST_NAME) continue;
    imageBytes.set(entry.name, entry.data);
  }
  return { manifest: parsed, imageBytes };
}

export type MergeMode = "replace" | "append" | "new";

export interface DeserializeOptions {
  bundle: ParsedBundle;
  imageDir: string;
  mode: MergeMode;
  existing?: PinpointReview | null;
  store: FileReviewStore;
}

// Attachment ids only resolve within their own review, so importing re-saves the
// bundled bytes under the target review and issues fresh ids (mirrors image handling).
async function restoreAttachments(
  annotations: PinpointAnnotation[],
  targetReviewId: string,
  imageBytes: Map<string, Buffer>,
  store: FileReviewStore
): Promise<PinpointAnnotation[]> {
  const result: PinpointAnnotation[] = [];
  for (const ann of annotations) {
    if (!ann.attachments || ann.attachments.length === 0) {
      result.push(ann);
      continue;
    }
    const restored: AnnotationAttachment[] = [];
    for (const attachment of ann.attachments) {
      const zipName = `${ATTACHMENT_PREFIX}${ann.id}-${attachment.id}`;
      const bytes = imageBytes.get(zipName);
      if (!bytes) throw new Error(`Bundle missing attachment: ${zipName}`);
      const saved = await store.saveAttachment(targetReviewId, bytes);
      restored.push({ id: saved.id, width: attachment.width, height: attachment.height });
    }
    result.push({ ...ann, attachments: restored });
  }
  return result;
}

export async function deserialize(opts: DeserializeOptions): Promise<PinpointReview> {
  const { bundle, imageDir, mode, existing, store } = opts;
  const { manifest, imageBytes } = bundle;
  await fs.promises.mkdir(imageDir, { recursive: true });

  const writtenImages: ImageInfo[] = [];
  for (let i = 0; i < manifest.images.length; i++) {
    const img = manifest.images[i];
    const bytes = imageBytes.get(img.name);
    if (!bytes) throw new Error(`Bundle missing image: ${img.name}`);
    const dest = path.join(imageDir, path.basename(img.name));
    await fs.promises.writeFile(dest, bytes);
    writtenImages.push({
      path: dest,
      width: img.width,
      height: img.height,
      ...(img.details ? { details: img.details } : {}),
    });
  }

  const id = mode === "append" && existing ? existing.id : mode === "new" ? generateId() : manifest.id;
  const restoredAnnotations = await restoreAttachments(manifest.annotations, id, imageBytes, store);

  if (mode === "append" && existing) {
    const baseNumber = existing.annotations.reduce((m, a) => Math.max(m, a.number), 0);
    const renumbered = restoredAnnotations.map((a, i) => ({
      ...a,
      id: generateId(),
      number: baseNumber + i + 1,
    }));
    return {
      ...existing,
      annotations: [...existing.annotations, ...renumbered],
    };
  }

  return {
    version: "1.0",
    id,
    images: writtenImages,
    context: manifest.context,
    createdAt: mode === "new" ? new Date().toISOString() : manifest.createdAt,
    annotations: restoredAnnotations,
  };
}
