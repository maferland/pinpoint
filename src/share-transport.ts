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
  | { tier: "blob"; blobUrl: string; key: string };

function encodeText(value: string): string {
  return encodeInline(new TextEncoder().encode(value));
}

function decodeText(encoded: string): string {
  return new TextDecoder().decode(decodeInline(encoded));
}

function splitFragment(fragment: string): [marker: string, data: string, key: string] {
  const first = fragment.indexOf(".");
  const second = fragment.indexOf(".", first + 1);
  if (first === -1 || second === -1) throw new Error("Malformed share link fragment");
  return [fragment.slice(0, first), fragment.slice(first + 1, second), fragment.slice(second + 1)];
}

export function buildInlineLink(payload: Uint8Array, key: string, baseUrl = DEFAULT_SHARE_BASE_URL): string {
  return `${baseUrl}/s#i.${encodeInline(payload)}.${key}`;
}

// blobUrl is Vercel Blob's public, unguessable object URL returned by the
// upload endpoint — the CLI fetches it directly, no server-side lookup needed.
export function buildBlobLink(blobUrl: string, key: string, baseUrl = DEFAULT_SHARE_BASE_URL): string {
  return `${baseUrl}/s#b.${encodeText(blobUrl)}.${key}`;
}

export function parseShareLink(url: string): ShareLink {
  const parsed = new URL(url);
  if (parsed.pathname !== "/s") throw new Error("Not a pinpoint share link");
  const fragment = parsed.hash.replace(/^#/, "");
  if (!fragment) throw new Error("Share link is missing its fragment (the decryption key)");

  const [marker, data, key] = splitFragment(fragment);
  if (marker === "i") return { tier: "inline", payload: decodeInline(data), key };
  if (marker === "b") return { tier: "blob", blobUrl: decodeText(data), key };
  throw new Error(`Unknown share link tier: ${marker}`);
}

export interface UploadOptions {
  baseUrl?: string;
  ttlDays?: number;
}

// Returns the blob's direct, public object URL — that URL becomes part of the
// share link itself, so downloadBlob never needs to call back into our API.
export async function uploadBlob(payload: Uint8Array, opts: UploadOptions = {}): Promise<string> {
  const baseUrl = opts.baseUrl ?? DEFAULT_SHARE_BASE_URL;
  const res = await fetch(`${baseUrl}/api/share/upload${opts.ttlDays ? `?ttlDays=${opts.ttlDays}` : ""}`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: payload as BodyInit,
  });
  if (!res.ok) throw new Error(`Share upload failed: ${res.status} ${await res.text()}`);
  const { url } = (await res.json()) as { url: string };
  return url;
}

export async function downloadBlob(blobUrl: string): Promise<Uint8Array> {
  const res = await fetch(blobUrl);
  if (res.status === 404) throw new Error("Share link has expired or does not exist");
  if (!res.ok) throw new Error(`Share download failed: ${res.status} ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}
