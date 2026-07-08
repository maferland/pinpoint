const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

// Our Uint8Arrays are always ArrayBuffer-backed, but TS's BufferSource type demands that explicitly.
function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as BufferSource;
}

const CHUNK_SIZE = 0x8000; // avoid blowing the call stack on String.fromCharCode(...bytes) for large arrays

// btoa/atob are available in Node, Bun, and browsers alike — this file has no
// runtime-specific dependency so it can run unmodified in the share-view bundle.
export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface EncryptedBundle {
  // IV followed by the AES-GCM ciphertext (including auth tag).
  payload: Uint8Array;
  // Base64url-encoded raw AES-256 key. Never sent to a server — lives in the
  // share link's URL fragment only.
  key: string;
}

export function generateKey(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function encryptWithKey(bytes: Uint8Array, key: string): Promise<Uint8Array> {
  const rawKey = fromBase64Url(key);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cryptoKey = await crypto.subtle.importKey("raw", asBufferSource(rawKey), ALGORITHM, false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, cryptoKey, asBufferSource(bytes));

  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), iv.length);
  return payload;
}

export async function encryptBundle(bytes: Uint8Array): Promise<EncryptedBundle> {
  const key = generateKey();
  const payload = await encryptWithKey(bytes, key);
  return { payload, key };
}

export async function decryptBundle(payload: Uint8Array, key: string): Promise<Uint8Array> {
  const rawKey = fromBase64Url(key);
  const iv = payload.slice(0, IV_LENGTH);
  const ciphertext = payload.slice(IV_LENGTH);
  const cryptoKey = await crypto.subtle.importKey("raw", asBufferSource(rawKey), ALGORITHM, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, cryptoKey, asBufferSource(ciphertext));
  return new Uint8Array(plaintext);
}
