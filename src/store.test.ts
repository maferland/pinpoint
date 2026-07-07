import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { FileReviewStore } from "./store.js";
import type { PinpointReview } from "./types.js";

function makeReview(id: string, overrides?: Partial<PinpointReview>): PinpointReview {
  return {
    version: "1.0",
    id,
    images: [{ path: "/tmp/test.png", width: 800, height: 600 }],
    createdAt: new Date().toISOString(),
    annotations: [],
    ...overrides,
  };
}

describe("FileReviewStore", () => {
  let dir: string;
  let store: FileReviewStore;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "pinpoint-test-"));
    store = new FileReviewStore(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("saves and loads a review", async () => {
    const review = makeReview("abc123");
    await store.save(review);
    expect(await store.load("abc123")).toEqual(review);
  });

  it("returns null for missing review", async () => {
    expect(await store.load("nonexistent")).toBeNull();
  });

  it("lists reviews sorted by createdAt descending", async () => {
    await store.save(makeReview("old", { createdAt: "2026-01-01T00:00:00Z" }));
    await store.save(makeReview("new", { createdAt: "2026-04-01T00:00:00Z" }));
    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe("new");
    expect(list[1].id).toBe("old");
  });

  it("overwrites review on save", async () => {
    const review = makeReview("abc123");
    await store.save(review);
    review.annotations = [{
      id: "a1", number: 1, imageIndex: 0, pin: { x: 50, y: 50 },
      comment: "test",
    }];
    await store.save(review);
    expect((await store.load("abc123"))?.annotations).toHaveLength(1);
  });

  it("rejects invalid IDs", async () => {
    expect(store.save(makeReview("../escape"))).rejects.toThrow("Invalid review id");
    expect(store.save(makeReview("has spaces"))).rejects.toThrow("Invalid review id");
    expect(store.load("../escape")).rejects.toThrow("Invalid review id");
  });

  it("persists to filesystem", async () => {
    await store.save(makeReview("persisted"));
    expect(fs.readdirSync(dir)).toContain("persisted.json");
  });

  it("preserves context field", async () => {
    await store.save(makeReview("ctx", { context: "Login page" }));
    expect((await store.load("ctx"))?.context).toBe("Login page");
  });

  it("preserves per-image details", async () => {
    const review = makeReview("with-details", {
      images: [{
        path: "/tmp/page.png",
        width: 800,
        height: 600,
        details: { route: "/cart", state: "3 items", focus: "CTA spacing" },
      }],
    });
    await store.save(review);
    const loaded = await store.load("with-details");
    expect(loaded?.images[0].details).toEqual({
      route: "/cart",
      state: "3 items",
      focus: "CTA spacing",
    });
  });
});

const ONE_PX_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

describe("FileReviewStore attachments", () => {
  let dir: string;
  let store: FileReviewStore;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "pinpoint-test-"));
    store = new FileReviewStore(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("saves an attachment and returns its sniffed dimensions", async () => {
    await store.save(makeReview("rev1"));
    const attachment = await store.saveAttachment("rev1", ONE_PX_PNG);
    expect(attachment.width).toBe(1);
    expect(attachment.height).toBe(1);
    expect(fs.readFileSync(store.attachmentPath("rev1", attachment.id))).toEqual(ONE_PX_PNG);
  });

  it("deletes an attachment", async () => {
    await store.save(makeReview("rev1"));
    const attachment = await store.saveAttachment("rev1", ONE_PX_PNG);
    await store.deleteAttachment("rev1", attachment.id);
    expect(fs.existsSync(store.attachmentPath("rev1", attachment.id))).toBe(false);
  });

  it("rejects attachment ids that attempt path traversal", () => {
    expect(() => store.attachmentPath("rev1", "../../etc/passwd")).toThrow();
    expect(() => store.attachmentPath("../escape", "abc")).toThrow();
  });

  it("removes a review's attachments directory when it is pruned", async () => {
    await store.save(makeReview("oldest", { createdAt: "2020-01-01T00:00:00Z" }));
    const attachment = await store.saveAttachment("oldest", ONE_PX_PNG);
    const attachmentPath = store.attachmentPath("oldest", attachment.id);
    expect(fs.existsSync(attachmentPath)).toBe(true);

    for (let i = 0; i < 50; i++) {
      await store.save(makeReview(`filler-${i}`, { createdAt: `2026-01-${(i % 28) + 1}T00:00:00Z` }));
    }

    expect(await store.load("oldest")).toBeNull();
    expect(fs.existsSync(attachmentPath)).toBe(false);
  });
});
