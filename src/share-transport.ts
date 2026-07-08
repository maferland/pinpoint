import { fromBase64Url, generateKey, toBase64Url } from "./share-crypto.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./share-config.js";

export const DEFAULT_SHARE_BASE_URL = "https://pinpoint.maferland.com";

// Encoded (base64url) length above which the payload no longer fits safely in
// a URL fragment and must go through the Supabase relay instead.
const INLINE_MAX_ENCODED_LENGTH = 6000;

export function shouldInline(payload: Uint8Array): boolean {
  return toBase64Url(payload).length <= INLINE_MAX_ENCODED_LENGTH;
}

// shareId is the row id: it locates the bundle (supabase tier) and is the response
// mailbox for both tiers. responseKey is the AES key the reviewer's browser encrypts with.
export interface ResponseChannel {
  shareId: string;
  responseKey: string;
}

export function generateResponseChannel(): ResponseChannel {
  return { shareId: crypto.randomUUID(), responseKey: generateKey() };
}

export type ShareLink =
  | ({ tier: "inline"; payload: Uint8Array; key: string } & ResponseChannel)
  | ({ tier: "supabase"; key: string } & ResponseChannel);

function buildLink(fragment: URLSearchParams, baseUrl: string): string {
  return `${baseUrl}/s#${fragment.toString()}`;
}

export function buildInlineLink(
  payload: Uint8Array,
  key: string,
  channel: ResponseChannel,
  baseUrl = DEFAULT_SHARE_BASE_URL
): string {
  return buildLink(
    new URLSearchParams({ t: "i", d: toBase64Url(payload), k: key, s: channel.shareId, rk: channel.responseKey }),
    baseUrl
  );
}

export function buildSupabaseLink(
  key: string,
  channel: ResponseChannel,
  baseUrl = DEFAULT_SHARE_BASE_URL
): string {
  return buildLink(
    new URLSearchParams({ t: "s", k: key, s: channel.shareId, rk: channel.responseKey }),
    baseUrl
  );
}

export function parseShareLink(url: string): ShareLink {
  const parsed = new URL(url);
  if (parsed.pathname.replace(/\/+$/, "") !== "/s") throw new Error("Not a pinpoint share link");
  const fragment = parsed.hash.replace(/^#/, "");
  if (!fragment) throw new Error("Share link is missing its fragment (the decryption key)");

  const params = new URLSearchParams(fragment);
  const tier = params.get("t");
  const key = params.get("k");
  const shareId = params.get("s");
  const responseKey = params.get("rk");
  if (!key || !shareId || !responseKey) throw new Error("Malformed share link fragment");

  if (tier === "i") {
    const data = params.get("d");
    if (!data) throw new Error("Malformed share link fragment");
    return { tier: "inline", payload: fromBase64Url(data), key, shareId, responseKey };
  }
  if (tier === "s") return { tier: "supabase", key, shareId, responseKey };
  throw new Error(`Unknown share link tier: ${tier}`);
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text.length ? (JSON.parse(text) as string | null) : null;
}

export interface UploadOptions {
  ttlDays?: number;
}

// Stores the ciphertext bundle under the client-generated share id (supabase tier only).
export async function createShare(shareId: string, payload: Uint8Array, opts: UploadOptions = {}): Promise<void> {
  await rpc("create_share", { share_id: shareId, bundle: toBase64Url(payload), ttl_days: opts.ttlDays ?? 14 });
}

export async function fetchBundle(shareId: string): Promise<Uint8Array> {
  const bundle = await rpc("get_bundle", { share_id: shareId });
  if (!bundle) throw new Error("Share link has expired or does not exist");
  return fromBase64Url(bundle);
}

// The reviewer's browser PUTs its encrypted result; for the inline tier this upsert
// also creates the mailbox row, so sharing itself never touches the server.
export async function uploadResponse(shareId: string, payload: Uint8Array): Promise<void> {
  await rpc("put_response", { share_id: shareId, resp: toBase64Url(payload) });
}

// Returns null until the reviewer has submitted (poll again later).
export async function downloadResponse(shareId: string): Promise<Uint8Array | null> {
  const response = await rpc("get_response", { share_id: shareId });
  return response ? fromBase64Url(response) : null;
}
