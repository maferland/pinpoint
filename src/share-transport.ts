import { decodeInline, encodeInline } from "./share-crypto.js";

export const DEFAULT_SHARE_BASE_URL = "https://pinpoint.maferland.com";

// Encoded (base64url) length above which the payload no longer fits safely in
// a URL fragment and must go through the blob relay instead.
const INLINE_MAX_ENCODED_LENGTH = 6000;

export function shouldInline(payload: Uint8Array): boolean {
  return encodeInline(payload).length <= INLINE_MAX_ENCODED_LENGTH;
}

export type ShareLink =
  | { tier: "inline"; payload: Uint8Array; key: string }
  | { tier: "blob"; id: string; key: string };

export function buildInlineLink(payload: Uint8Array, key: string, baseUrl = DEFAULT_SHARE_BASE_URL): string {
  return `${baseUrl}/s#${encodeInline(payload)}.${key}`;
}

export function buildBlobLink(id: string, key: string, baseUrl = DEFAULT_SHARE_BASE_URL): string {
  return `${baseUrl}/s/${id}#${key}`;
}

export function parseShareLink(url: string): ShareLink {
  const parsed = new URL(url);
  const fragment = parsed.hash.replace(/^#/, "");
  if (!fragment) throw new Error("Share link is missing its fragment (the decryption key)");

  if (parsed.pathname === "/s") {
    const lastDot = fragment.lastIndexOf(".");
    if (lastDot === -1) throw new Error("Malformed inline share link");
    return {
      tier: "inline",
      payload: decodeInline(fragment.slice(0, lastDot)),
      key: fragment.slice(lastDot + 1),
    };
  }

  const match = parsed.pathname.match(/^\/s\/([^/]+)$/);
  if (!match) throw new Error("Not a pinpoint share link");
  return { tier: "blob", id: match[1], key: fragment };
}

export interface UploadOptions {
  baseUrl?: string;
  ttlDays?: number;
}

export async function uploadBlob(payload: Uint8Array, opts: UploadOptions = {}): Promise<string> {
  const baseUrl = opts.baseUrl ?? DEFAULT_SHARE_BASE_URL;
  const res = await fetch(`${baseUrl}/api/share${opts.ttlDays ? `?ttlDays=${opts.ttlDays}` : ""}`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: payload as BodyInit,
  });
  if (!res.ok) throw new Error(`Share upload failed: ${res.status} ${await res.text()}`);
  const { id } = (await res.json()) as { id: string };
  return id;
}

export async function downloadBlob(id: string, baseUrl = DEFAULT_SHARE_BASE_URL): Promise<Uint8Array> {
  const res = await fetch(`${baseUrl}/api/share/${id}`);
  if (res.status === 404) throw new Error("Share link has expired or does not exist");
  if (!res.ok) throw new Error(`Share download failed: ${res.status} ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}
