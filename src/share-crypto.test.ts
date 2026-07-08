import { describe, expect, it } from "bun:test";
import { decryptBundle, encryptBundle } from "./share-crypto.js";

describe("share-crypto", () => {
  it("round-trips arbitrary bytes through encrypt/decrypt", async () => {
    const original = new TextEncoder().encode("pinpoint review bundle bytes");
    const { payload, key } = await encryptBundle(original);
    const decrypted = await decryptBundle(payload, key);
    expect(Buffer.from(decrypted).toString()).toBe("pinpoint review bundle bytes");
  });

  it("produces a different key and payload on every call", async () => {
    const bytes = new TextEncoder().encode("same input");
    const a = await encryptBundle(bytes);
    const b = await encryptBundle(bytes);
    expect(a.key).not.toBe(b.key);
    expect(Buffer.from(a.payload).equals(Buffer.from(b.payload))).toBe(false);
  });

  it("fails to decrypt with the wrong key", async () => {
    const { payload } = await encryptBundle(new TextEncoder().encode("secret"));
    const { key: wrongKey } = await encryptBundle(new TextEncoder().encode("other"));
    await expect(decryptBundle(payload, wrongKey)).rejects.toThrow();
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const { payload, key } = await encryptBundle(new TextEncoder().encode("secret"));
    const tampered = new Uint8Array(payload);
    tampered[tampered.length - 1] ^= 0xff;
    await expect(decryptBundle(tampered, key)).rejects.toThrow();
  });
});
