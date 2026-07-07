import { fromBase64Url, toBase64Url } from "./share-crypto.js";

export const DEFAULT_SHARE_BASE_URL = "https://pinpoint.maferland.com";

// Encoded (base64url) length above which the payload no longer fits safely in
// a URL fragment and must go through the blob store instead.
const INLINE_MAX_ENCODED_LENGTH = 6000;

export function shouldInline(payload: Uint8Array): boolean {
  return toBase64Url(payload).length <= INLINE_MAX_ENCODED_LENGTH;
}

export type ShareLink =
  | { tier: "inline"; payload: Uint8Array; key: string }
  | { tier: "blob"; blobUrl: string; key: string };

function buildLink(fragment: URLSearchParams, baseUrl: string): string {
  return `${baseUrl}/s#${fragment.toString()}`;
}

export function buildInlineLink(payload: Uint8Array, key: string, baseUrl = DEFAULT_SHARE_BASE_URL): string {
  return buildLink(new URLSearchParams({ t: "i", d: toBase64Url(payload), k: key }), baseUrl);
}

// blobUrl is Vercel Blob's public, unguessable object URL returned by the
// upload endpoint — the CLI fetches it directly, no server-side lookup needed.
export function buildBlobLink(blobUrl: string, key: string, baseUrl = DEFAULT_SHARE_BASE_URL): string {
  return buildLink(new URLSearchParams({ t: "b", d: blobUrl, k: key }), baseUrl);
}

export function parseShareLink(url: string): ShareLink {
  const parsed = new URL(url);
  if (parsed.pathname !== "/s") throw new Error("Not a pinpoint share link");
  const fragment = parsed.hash.replace(/^#/, "");
  if (!fragment) throw new Error("Share link is missing its fragment (the decryption key)");

  const params = new URLSearchParams(fragment);
  const tier = params.get("t");
  const data = params.get("d");
  const key = params.get("k");
  if (!data || !key) throw new Error("Malformed share link fragment");

  if (tier === "i") return { tier: "inline", payload: fromBase64Url(data), key };
  if (tier === "b") return { tier: "blob", blobUrl: data, key };
  throw new Error(`Unknown share link tier: ${tier}`);
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
