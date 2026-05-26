import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { deserialize, parseBundle, serialize } from "./export.js";
import { writeZip } from "./zip.js";
import type { PinpointReview } from "./types.js";

const TEST_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64,
  0x08, 0x02, 0x00, 0x00, 0x00,
]);

let dir: string;
let imagePath: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pinpoint-export-test-"));
  imagePath = path.join(dir, "screen.png");
  fs.writeFileSync(imagePath, TEST_PNG);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function makeReview(overrides?: Partial<PinpointReview>): PinpointReview {
  return {
    version: "1.0",
    id: "abc123",
    images: [{ path: imagePath, width: 100, height: 100, details: { route: "/cart" } }],
    context: "round-trip",
    createdAt: "2026-01-01T00:00:00.000Z",
    annotations: [
      { id: "a1", number: 1, imageIndex: 0, pin: { x: 50, y: 50 }, comment: "fix this" },
    ],
    ...overrides,
  };
}

describe("export.serialize", () => {
  it("produces a zip with review.json + images/ entries", async () => {
    const zip = await serialize(makeReview());
    // PKZip signature: 0x50 0x4b 0x03 0x04 ('PK\x03\x04')
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);

    const { manifest, imageBytes } = parseBundle(zip);
    expect(manifest.kind).toBe("pinpoint-export");
    expect(manifest.id).toBe("abc123");
    expect(manifest.context).toBe("round-trip");
    expect(manifest.images).toHaveLength(1);
    expect(manifest.images[0].mime).toBe("image/png");
    expect(manifest.images[0].name).toBe("images/0-screen.png");
    expect(manifest.images[0].details).toEqual({ route: "/cart" });

    const imgBuf = imageBytes.get("images/0-screen.png");
    expect(imgBuf).toBeDefined();
    expect(imgBuf!.equals(TEST_PNG)).toBe(true);
    expect(manifest.annotations).toHaveLength(1);
  });

  it("sanitizes unusual filenames", async () => {
    const weird = path.join(dir, "screen with spaces.png");
    fs.writeFileSync(weird, TEST_PNG);
    const review = makeReview({ images: [{ path: weird, width: 1, height: 1 }] });
    const { manifest } = parseBundle(await serialize(review));
    expect(manifest.images[0].name).toBe("images/0-screen_with_spaces.png");
  });
});

describe("export.deserialize", () => {
  it("round-trips a review: replace mode", async () => {
    const zip = await serialize(makeReview());
    const restored = await deserialize({
      bundle: parseBundle(zip),
      imageDir: path.join(dir, "restored"),
      mode: "replace",
    });
    expect(restored.id).toBe("abc123");
    expect(restored.annotations).toHaveLength(1);
    expect(restored.images[0].width).toBe(100);
    expect(fs.readFileSync(restored.images[0].path).equals(TEST_PNG)).toBe(true);
  });

  it("generates new id and createdAt in 'new' mode", async () => {
    const zip = await serialize(makeReview());
    const restored = await deserialize({
      bundle: parseBundle(zip),
      imageDir: path.join(dir, "new"),
      mode: "new",
    });
    expect(restored.id).not.toBe("abc123");
    expect(restored.createdAt).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("appends annotations with renumbered ids/numbers in 'append' mode", async () => {
    const zip = await serialize(makeReview());
    const existing = makeReview({
      id: "abc123",
      annotations: [
        { id: "x1", number: 1, imageIndex: 0, pin: { x: 10, y: 10 }, comment: "mine" },
        { id: "x2", number: 2, imageIndex: 0, pin: { x: 20, y: 20 }, comment: "mine 2" },
      ],
    });
    const merged = await deserialize({
      bundle: parseBundle(zip),
      imageDir: path.join(dir, "append"),
      mode: "append",
      existing,
    });
    expect(merged.annotations).toHaveLength(3);
    expect(merged.annotations[2].number).toBe(3);
    expect(merged.annotations[2].comment).toBe("fix this");
    expect(merged.annotations[2].id).not.toBe("a1");
  });
});

describe("parseBundle", () => {
  it("rejects non-zip data", () => {
    expect(() => parseBundle(Buffer.from("nope"))).toThrow(/not a valid zip/i);
  });

  it("rejects a zip missing review.json", () => {
    const zip = writeZip([{ name: "other.txt", data: Buffer.from("hi") }]);
    expect(() => parseBundle(zip)).toThrow(/missing review\.json/);
  });

  it("rejects a manifest with the wrong kind", () => {
    const zip = writeZip([
      { name: "review.json", data: Buffer.from(JSON.stringify({ kind: "other", version: "1.0", images: [], annotations: [] })) },
    ]);
    expect(() => parseBundle(zip)).toThrow(/pinpoint-export/);
  });
});
