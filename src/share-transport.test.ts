import { afterEach, describe, expect, it, mock } from "bun:test";
import { encryptBundle } from "./share-crypto.js";
import {
  buildBlobLink,
  buildInlineLink,
  downloadBlob,
  parseShareLink,
  shouldInline,
  uploadBlob,
} from "./share-transport.js";

describe("shouldInline", () => {
  it("is true for small payloads", () => {
    expect(shouldInline(new Uint8Array(100))).toBe(true);
  });

  it("is false for payloads that would blow up the URL length", () => {
    expect(shouldInline(new Uint8Array(10_000))).toBe(false);
  });
});

describe("share link round-trip", () => {
  it("builds and parses an inline link", async () => {
    const { payload, key } = await encryptBundle(new TextEncoder().encode("hi"));
    const link = buildInlineLink(payload, key, "https://example.test");
    const parsed = parseShareLink(link);
    expect(parsed.tier).toBe("inline");
    if (parsed.tier !== "inline") throw new Error("expected inline");
    expect(parsed.key).toBe(key);
    expect(Buffer.from(parsed.payload).equals(Buffer.from(payload))).toBe(true);
  });

  it("builds and parses a blob link", () => {
    const blobUrl = "https://abc123.public.blob.vercel-storage.com/share/171-xyz.bin";
    const link = buildBlobLink(blobUrl, "the-key", "https://example.test");
    const parsed = parseShareLink(link);
    expect(parsed).toEqual({ tier: "blob", blobUrl, key: "the-key" });
  });

  it("rejects a link with no fragment", () => {
    expect(() => parseShareLink("https://example.test/s")).toThrow();
  });

  it("rejects a link that isn't a share link", () => {
    expect(() => parseShareLink("https://example.test/other#t=i&d=a&k=b")).toThrow();
  });

  it("rejects a link with an unknown tier marker", () => {
    expect(() => parseShareLink("https://example.test/s#t=x&d=a&k=b")).toThrow(/Unknown share link tier/);
  });

  it("rejects a link missing required fragment fields", () => {
    expect(() => parseShareLink("https://example.test/s#t=i&k=b")).toThrow(/Malformed/);
  });
});

describe("blob upload/download", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("uploads a payload and returns the blob url", async () => {
    global.fetch = mock(
      async () => new Response(JSON.stringify({ url: "https://blob.test/x" }), { status: 200 })
    ) as unknown as typeof fetch;
    const url = await uploadBlob(new Uint8Array([1, 2, 3]), { baseUrl: "https://example.test" });
    expect(url).toBe("https://blob.test/x");
  });

  it("throws when upload fails", async () => {
    global.fetch = mock(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(uploadBlob(new Uint8Array([1]), { baseUrl: "https://example.test" })).rejects.toThrow();
  });

  it("downloads a payload from its blob url", async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    global.fetch = mock(async () => new Response(bytes, { status: 200 })) as unknown as typeof fetch;
    const result = await downloadBlob("https://blob.test/x");
    expect(Buffer.from(result).equals(Buffer.from(bytes))).toBe(true);
  });

  it("throws a friendly error on 404", async () => {
    global.fetch = mock(async () => new Response("not found", { status: 404 })) as unknown as typeof fetch;
    await expect(downloadBlob("https://blob.test/missing")).rejects.toThrow(/expired/);
  });
});
