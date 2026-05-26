import { spawn, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";

const CLI_PATH = path.join(import.meta.dirname!, "..", "dist", "cli.js");

beforeAll(() => {
  if (fs.existsSync(CLI_PATH)) return;
  // Self-build if dist is missing — keeps `bun test` working without a
  // separate `bun run build` step (and avoids a CI ordering footgun).
  const result = spawnSync("bun", ["run", "build"], {
    cwd: path.join(import.meta.dirname!, ".."),
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("build failed");
});

const TEST_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64,
  0x08, 0x02, 0x00, 0x00, 0x00,
]);

function pickPort(): number {
  return 50000 + Math.floor(Math.random() * 10000);
}

function spawnCli(args: string[]) {
  const proc = spawn("node", [CLI_PATH, ...args], {
    env: { ...process.env, PINPOINT_TEST_NO_OPEN: "1" },
  });
  let stdout = "";
  let stderr = "";
  proc.stdout?.on("data", (c) => { stdout += c.toString(); });
  proc.stderr?.on("data", (c) => { stderr += c.toString(); });
  const exited = new Promise<number>((resolve) => {
    proc.on("exit", (code) => resolve(code ?? -1));
  });
  return {
    proc,
    exited,
    get stdout() { return stdout; },
    get stderr() { return stderr; },
  };
}

async function waitForReviewId(getStderr: () => string, timeoutMs = 5000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const m = getStderr().match(/\/review\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`cli not ready in ${timeoutMs}ms: ${getStderr()}`);
}

describe("pinpoint export/open cli", () => {
  let imagePath: string;
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "pinpoint-cli-export-test-"));
    imagePath = path.join(dir, "test.png");
    fs.writeFileSync(imagePath, TEST_PNG);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips a review through export then open", async () => {
    // 1. Create a review via `review`, attach annotations, finalize.
    const port = pickPort();
    const reviewCli = spawnCli(["review", imagePath, "--context", "roundtrip", "--port", String(port)]);
    const reviewId = await waitForReviewId(() => reviewCli.stderr);

    const annPut = await fetch(`http://localhost:${port}/api/review/${reviewId}/annotations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{
        id: "a1", number: 1, imageIndex: 0, pin: { x: 30, y: 30 },
        comment: "original comment",
      }]),
    });
    expect(annPut.status).toBe(200);
    await fetch(`http://localhost:${port}/api/review/${reviewId}/finalize`, { method: "POST" });
    expect(await reviewCli.exited).toBe(0);

    // 2. Export the review to a zip file.
    const { parseBundle } = await import("./export.js");
    const bundlePath = path.join(dir, "out.pinpoint.zip");
    const exportCli = spawnCli(["export", reviewId, "--output", bundlePath]);
    expect(await exportCli.exited).toBe(0);
    expect(fs.existsSync(bundlePath)).toBe(true);
    const zipBytes = fs.readFileSync(bundlePath);
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);
    const { manifest, imageBytes } = parseBundle(zipBytes);
    expect(manifest.kind).toBe("pinpoint-export");
    expect(manifest.annotations[0].comment).toBe("original comment");
    expect(imageBytes.size).toBe(1);

    // 3. Re-open the bundle (reviewer perspective, fresh review), add a new
    //    comment, finalize. Verify both annotations come through.
    const openPort = pickPort();
    const openCli = spawnCli(["open", bundlePath, "--mode", "new", "--port", String(openPort)]);
    const openedId = await waitForReviewId(() => openCli.stderr);
    expect(openedId).not.toBe(reviewId);

    const review = await (await fetch(`http://localhost:${openPort}/api/review/${openedId}`)).json() as {
      annotations: Array<{ id: string; number: number; imageIndex: number; pin: { x: number; y: number }; comment: string }>;
    };
    expect(review.annotations).toHaveLength(1);
    expect(review.annotations[0].comment).toBe("original comment");

    await fetch(`http://localhost:${openPort}/api/review/${openedId}/annotations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        ...review.annotations,
        { id: "a2", number: 2, imageIndex: 0, pin: { x: 70, y: 70 }, comment: "reviewer comment" },
      ]),
    });
    await fetch(`http://localhost:${openPort}/api/review/${openedId}/finalize`, { method: "POST" });
    expect(await openCli.exited).toBe(0);

    const out = JSON.parse(openCli.stdout) as { annotations: Array<{ comment: string }> };
    expect(out.annotations.map((a) => a.comment)).toEqual(["original comment", "reviewer comment"]);
  }, 20000);

  it("--mode append merges bundle annotations into an existing local review", async () => {
    // Seed a local review with one annotation.
    const port = pickPort();
    const seedCli = spawnCli(["review", imagePath, "--port", String(port)]);
    const reviewId = await waitForReviewId(() => seedCli.stderr);
    await fetch(`http://localhost:${port}/api/review/${reviewId}/annotations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{
        id: "local-1", number: 1, imageIndex: 0, pin: { x: 10, y: 10 },
        comment: "local annotation",
      }]),
    });
    await fetch(`http://localhost:${port}/api/review/${reviewId}/finalize`, { method: "POST" });
    await seedCli.exited;

    // Export the seeded review, then mutate the bundle to add a second
    // annotation as if a reviewer had added one on their side.
    const bundlePath = path.join(dir, "merge.pinpoint.zip");
    expect((await spawnCli(["export", reviewId, "--output", bundlePath]).exited)).toBe(0);

    const { parseBundle } = await import("./export.js");
    const { writeZip } = await import("./zip.js");
    const parsed = parseBundle(fs.readFileSync(bundlePath));
    parsed.manifest.annotations.push({
      id: "incoming-1", number: 1, imageIndex: 0, pin: { x: 80, y: 80 },
      comment: "reviewer annotation",
    });
    // Rewrite the zip with the mutated manifest so the bundle has 2 annotations.
    const mutated = writeZip([
      { name: "review.json", data: Buffer.from(JSON.stringify(parsed.manifest)) },
      ...[...parsed.imageBytes].map(([name, data]) => ({ name, data })),
    ]);
    fs.writeFileSync(bundlePath, mutated);

    // Open with --mode append. Existing local review has 1 annotation;
    // bundle now has 2. After append we expect 3 (1 local + 2 incoming).
    const openPort = pickPort();
    const openCli = spawnCli(["open", bundlePath, "--mode", "append", "--port", String(openPort)]);
    const openedId = await waitForReviewId(() => openCli.stderr);
    expect(openedId).toBe(reviewId);

    const got = await (await fetch(`http://localhost:${openPort}/api/review/${openedId}`)).json() as {
      annotations: Array<{ number: number; comment: string }>;
    };
    expect(got.annotations.map((a) => a.comment)).toEqual([
      "local annotation",
      "local annotation",
      "reviewer annotation",
    ]);
    // Renumbered: 1 (existing), then 2 and 3 from the bundle.
    expect(got.annotations.map((a) => a.number)).toEqual([1, 2, 3]);

    await fetch(`http://localhost:${openPort}/api/review/${openedId}/finalize`, { method: "POST" });
    expect(await openCli.exited).toBe(0);
  }, 20000);

  it("--mode replace overwrites a colliding local review", async () => {
    const port = pickPort();
    const seedCli = spawnCli(["review", imagePath, "--port", String(port)]);
    const reviewId = await waitForReviewId(() => seedCli.stderr);
    await fetch(`http://localhost:${port}/api/review/${reviewId}/annotations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{
        id: "local-1", number: 1, imageIndex: 0, pin: { x: 10, y: 10 },
        comment: "to be replaced",
      }]),
    });
    await fetch(`http://localhost:${port}/api/review/${reviewId}/finalize`, { method: "POST" });
    await seedCli.exited;

    const bundlePath = path.join(dir, "replace.pinpoint.zip");
    expect((await spawnCli(["export", reviewId, "--output", bundlePath]).exited)).toBe(0);

    // The bundle (exported just now) carries the "to be replaced" annotation.
    // Replace mode should leave the review with exactly the bundle's annotations.
    const openPort = pickPort();
    const openCli = spawnCli(["open", bundlePath, "--mode", "replace", "--port", String(openPort)]);
    const openedId = await waitForReviewId(() => openCli.stderr);
    expect(openedId).toBe(reviewId);

    const got = await (await fetch(`http://localhost:${openPort}/api/review/${openedId}`)).json() as {
      annotations: Array<{ comment: string }>;
    };
    expect(got.annotations).toHaveLength(1);
    expect(got.annotations[0].comment).toBe("to be replaced");

    await fetch(`http://localhost:${openPort}/api/review/${openedId}/finalize`, { method: "POST" });
    expect(await openCli.exited).toBe(0);
  }, 20000);

  it("open exits with a clear error when the file is not a zip", async () => {
    const badPath = path.join(dir, "bad.pinpoint.zip");
    fs.writeFileSync(badPath, "not a zip");
    const cli = spawnCli(["open", badPath]);
    const code = await cli.exited;
    expect(code).toBe(1);
    expect(cli.stderr).toMatch(/not a valid zip/i);
  });
});

describe("pinpoint review cli", () => {
  let imagePath: string;
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "pinpoint-cli-test-"));
    imagePath = path.join(dir, "test.png");
    fs.writeFileSync(imagePath, TEST_PNG);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("starts a server, accepts annotations, finalizes, prints JSON, exits fast", async () => {
    const port = pickPort();
    const cli = spawnCli(["review", imagePath, "--context", "smoke", "--port", String(port)]);
    const reviewId = await waitForReviewId(() => cli.stderr);

    const annRes = await fetch(`http://localhost:${port}/api/review/${reviewId}/annotations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{
        id: "a1", number: 1, imageIndex: 0, pin: { x: 50, y: 50 },
        box: { x: 40, y: 40, width: 20, height: 20 },
        comment: "smoke",
      }]),
    });
    expect(annRes.status).toBe(200);

    const tFinalize = Date.now();
    await fetch(`http://localhost:${port}/api/review/${reviewId}/finalize`, { method: "POST" });
    const exitCode = await cli.exited;
    const exitTime = Date.now() - tFinalize;

    expect(exitCode).toBe(0);
    // Proves the keep-alive fix — without closeAllConnections + grace timer
    // this would take ~5s (Node default keepAliveTimeout).
    expect(exitTime).toBeLessThan(2000);

    const json = JSON.parse(cli.stdout);
    expect(json.context).toBe("smoke");
    expect(json.images).toHaveLength(1);
    expect(json.annotations).toHaveLength(1);
    expect(json.annotations[0].comment).toBe("smoke");
    expect(json.annotations[0].pin).toEqual({ x: 50, y: 50 });
  }, 10000);

  it("exits with usage when no images given", async () => {
    const cli = spawnCli(["review"]);
    const code = await cli.exited;
    expect(code).toBe(2);
    expect(cli.stderr).toContain("usage:");
  });

  it("exits with error when image is missing", async () => {
    const cli = spawnCli(["review", "/tmp/does-not-exist-pinpoint.png"]);
    const code = await cli.exited;
    expect(code).toBe(1);
    expect(cli.stderr).toMatch(/not found|unreadable/i);
  });
});
