import { afterEach, describe, expect, it, mock } from "bun:test";
import { encryptBundle, toBase64Url } from "./share-crypto.js";
import {
  buildInlineLink,
  buildSupabaseLink,
  createShare,
  downloadResponse,
  fetchBundle,
  generateResponseChannel,
  parseShareLink,
  shouldInline,
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

  it("builds and parses a supabase link, carrying the response channel", () => {
    const channel = generateResponseChannel();
    const link = buildSupabaseLink("the-key", channel, "https://example.test");
    const parsed = parseShareLink(link);
    expect(parsed).toEqual({ tier: "supabase", key: "the-key", ...channel });
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

describe("supabase relay transport", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("createShare posts the base64url bundle to the create_share rpc", async () => {
    let captured: { url: string; body: Record<string, unknown> } | undefined;
    global.fetch = mock(async (url: string, init: RequestInit) => {
      captured = { url: String(url), body: JSON.parse(init.body as string) };
      return new Response("", { status: 204 });
    }) as unknown as typeof fetch;
    await createShare("share-1", new Uint8Array([1, 2, 3]), { ttlDays: 7 });
    expect(captured?.url).toContain("/rest/v1/rpc/create_share");
    expect(captured?.body.share_id).toBe("share-1");
    expect(captured?.body.ttl_days).toBe(7);
    expect(typeof captured?.body.bundle).toBe("string");
  });

  it("createShare surfaces rpc errors", async () => {
    global.fetch = mock(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
    await expect(createShare("x", new Uint8Array([1]))).rejects.toThrow();
  });

  it("fetchBundle decodes the stored ciphertext", async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    global.fetch = mock(
      async () => new Response(JSON.stringify(toBase64Url(bytes)), { status: 200 })
    ) as unknown as typeof fetch;
    const result = await fetchBundle("share-1");
    expect(Buffer.from(result).equals(Buffer.from(bytes))).toBe(true);
  });

  it("fetchBundle throws a friendly error when the row is missing or expired", async () => {
    global.fetch = mock(async () => new Response("null", { status: 200 })) as unknown as typeof fetch;
    await expect(fetchBundle("gone")).rejects.toThrow(/expired/);
  });
});

describe("response mailbox", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("uploads a response payload", async () => {
    global.fetch = mock(async () => new Response("", { status: 204 })) as unknown as typeof fetch;
    await expect(uploadResponse("share-1", new Uint8Array([1, 2]))).resolves.toBeUndefined();
  });

  it("returns null when no response has been submitted yet", async () => {
    global.fetch = mock(async () => new Response("null", { status: 200 })) as unknown as typeof fetch;
    expect(await downloadResponse("share-1")).toBeNull();
  });

  it("returns the response bytes once submitted", async () => {
    const bytes = new Uint8Array([5, 6, 7]);
    global.fetch = mock(
      async () => new Response(JSON.stringify(toBase64Url(bytes)), { status: 200 })
    ) as unknown as typeof fetch;
    const result = await downloadResponse("share-1");
    expect(result && Buffer.from(result).equals(Buffer.from(bytes))).toBe(true);
  });
});
