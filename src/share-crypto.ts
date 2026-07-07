const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

export interface EncryptedBundle {
  // IV followed by the AES-GCM ciphertext (including auth tag).
  payload: Uint8Array;
  // Base64url-encoded raw AES-256 key. Never sent to a server — lives in the
  // share link's URL fragment only.
  key: string;
}

export async function encryptBundle(bytes: Uint8Array): Promise<EncryptedBundle> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cryptoKey = await crypto.subtle.importKey("raw", rawKey, ALGORITHM, false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, cryptoKey, bytes as BufferSource);

  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), iv.length);

  return { payload, key: toBase64Url(rawKey) };
}

export async function decryptBundle(payload: Uint8Array, key: string): Promise<Uint8Array> {
  const rawKey = fromBase64Url(key);
  const iv = payload.slice(0, IV_LENGTH);
  const ciphertext = payload.slice(IV_LENGTH);
  const cryptoKey = await crypto.subtle.importKey("raw", rawKey as BufferSource, ALGORITHM, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, cryptoKey, ciphertext as BufferSource);
  return new Uint8Array(plaintext);
}

export function encodeInline(payload: Uint8Array): string {
  return toBase64Url(payload);
}

export function decodeInline(encoded: string): Uint8Array {
  return fromBase64Url(encoded);
}
