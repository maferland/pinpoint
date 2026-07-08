import { afterEach, describe, expect, it, mock } from "bun:test";
import { encryptBundle } from "./share-crypto.js";
import {
  buildBlobLink,
  buildInlineLink,
  downloadBlob,
  downloadResponse,
  generateResponseChannel,
  parseShareLink,
  shouldInline,
  uploadBlob,
  uploadResponse,
} from "./share-transport.js";

describe("shouldInline", () => {
  it("is true for small payloads", () => {
    expect(shouldInline(new Uint8Array(100))).toBe(true);
  });

  it("is false for payloads that would blow up the URL length", () => {
    expect(shouldInline(new Uint8Array(10_000))).toBe(false);
  });
});

describe("generateResponseChannel", () => {
  it("produces a unique shareId and responseKey each time", () => {
    const a = generateResponseChannel();
    const b = generateResponseChannel();
    expect(a.shareId).not.toBe(b.shareId);
    expect(a.responseKey).not.toBe(b.responseKey);
  });
});

describe("share link round-trip", () => {
  it("builds and parses an inline link, carrying the response channel", async () => {
    const { payload, key } = await encryptBundle(new TextEncoder().encode("hi"));
    const channel = generateResponseChannel();
    const link = buildInlineLink(payload, key, channel, "https://example.test");
    const parsed = parseShareLink(link);
    expect(parsed.tier).toBe("inline");
    if (parsed.tier !== "inline") throw new Error("expected inline");
    expect(parsed.key).toBe(key);
    expect(parsed.shareId).toBe(channel.shareId);
    expect(parsed.responseKey).toBe(channel.responseKey);
    expect(Buffer.from(parsed.payload).equals(Buffer.from(payload))).toBe(true);
  });

  it("builds and parses a blob link, carrying the response channel", () => {
    const blobUrl = "https://abc123.public.blob.vercel-storage.com/share/171-xyz.bin";
    const channel = generateResponseChannel();
    const link = buildBlobLink(blobUrl, "the-key", channel, "https://example.test");
    const parsed = parseShareLink(link);
    expect(parsed).toEqual({ tier: "blob", blobUrl, key: "the-key", ...channel });
  });

  it("rejects a link with no fragment", () => {
    expect(() => parseShareLink("https://example.test/s")).toThrow();
  });

  it("rejects a link that isn't a share link", () => {
    expect(() => parseShareLink("https://example.test/other#t=i&d=a&k=b&s=c&rk=d")).toThrow();
  });

  it("rejects a link with an unknown tier marker", () => {
    expect(() => parseShareLink("https://example.test/s#t=x&d=a&k=b&s=c&rk=d")).toThrow(/Unknown share link tier/);
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

describe("response mailbox", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("uploads a response payload", async () => {
    global.fetch = mock(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch;
    await expect(uploadResponse("share-1", new Uint8Array([1, 2]), "https://example.test")).resolves.toBeUndefined();
  });

  it("returns null when no response has been submitted yet", async () => {
    global.fetch = mock(async () => new Response("not found", { status: 404 })) as unknown as typeof fetch;
    const result = await downloadResponse("share-1", "https://example.test");
    expect(result).toBeNull();
  });

  it("returns the response bytes once submitted", async () => {
    const bytes = new Uint8Array([5, 6, 7]);
    global.fetch = mock(async () => new Response(bytes, { status: 200 })) as unknown as typeof fetch;
    const result = await downloadResponse("share-1", "https://example.test");
    expect(result && Buffer.from(result).equals(Buffer.from(bytes))).toBe(true);
  });
});
