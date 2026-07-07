import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { ensureCliBuilt, spawnCli, TEST_PNG, waitForReady } from "./cli-test-harness.js";

beforeAll(ensureCliBuilt);

async function waitForLink(getStdout: () => string, timeoutMs = 5000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const out = getStdout().trim();
    if (out.startsWith("http")) return out;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`share link not printed in ${timeoutMs}ms: ${getStdout()}`);
}

// Same contract as site/api/share/upload + Vercel Blob's public storage, backed by memory.
function startMockBlobServer(): Promise<{ baseUrl: string; close: () => Promise<void>; uploadCount: number }> {
  const blobs = new Map<string, Buffer>();
  const state = { uploadCount: 0 };
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url?.startsWith("/api/share/upload")) {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        state.uploadCount++;
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        blobs.set(id, Buffer.concat(chunks));
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ url: `http://127.0.0.1:${port}/blobs/${id}` }));
      });
      return;
    }
    const blobMatch = req.url?.match(/^\/blobs\/(.+)$/);
    if (req.method === "GET" && blobMatch) {
      const bytes = blobs.get(blobMatch[1]);
      if (!bytes) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": "application/octet-stream" });
      res.end(bytes);
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
        get uploadCount() { return state.uploadCount; },
      });
    });
  });
}

describe("pinpoint share/open cli", () => {
  let dir: string;
  let imagePath: string;
  let mock: Awaited<ReturnType<typeof startMockBlobServer>>;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "pinpoint-cli-share-test-"));
    imagePath = path.join(dir, "test.png");
    fs.writeFileSync(imagePath, TEST_PNG);
    mock = await startMockBlobServer();
  });

  afterEach(async () => {
    fs.rmSync(dir, { recursive: true, force: true });
    await mock.close();
  });

  it("shares a small review inline (no server round trip) and opens it", async () => {
    const reviewCli = spawnCli(["review", imagePath, "--context", "inline-share"]);
    const { port, reviewId } = await waitForReady(() => reviewCli.stderr);
    await fetch(`http://localhost:${port}/api/review/${reviewId}/annotations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{
        id: "a1", number: 1, imageIndex: 0, pin: { x: 30, y: 30 }, comment: "small review",
      }]),
    });
    await fetch(`http://localhost:${port}/api/review/${reviewId}/finalize`, { method: "POST" });
    expect(await reviewCli.exited).toBe(0);

    const shareCli = spawnCli(["share", reviewId, "--server", mock.baseUrl]);
    const link = await waitForLink(() => shareCli.stdout);
    expect(await shareCli.exited).toBe(0);
    expect(link).toContain("/s#t=i&");
    expect(mock.uploadCount).toBe(0);

    const openCli = spawnCli(["open", link, "--mode", "new"]);
    const { port: openPort, reviewId: openedId } = await waitForReady(() => openCli.stderr);
    expect(openedId).not.toBe(reviewId);

    const review = await (await fetch(`http://localhost:${openPort}/api/review/${openedId}`)).json() as {
      context: string;
      annotations: Array<{ comment: string }>;
    };
    expect(review.context).toBe("inline-share");
    expect(review.annotations.map((a) => a.comment)).toEqual(["small review"]);

    await fetch(`http://localhost:${openPort}/api/review/${openedId}/finalize`, { method: "POST" });
    expect(await openCli.exited).toBe(0);
  }, 20000);

  it("shares a large review through the blob relay and opens it", async () => {
    const reviewCli = spawnCli(["review", imagePath, "--context", "blob-share"]);
    const { port, reviewId } = await waitForReady(() => reviewCli.stderr);

    const bigAttachment = Buffer.alloc(8000, 0x42);
    const uploadRes = await fetch(`http://localhost:${port}/api/review/${reviewId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: bigAttachment,
    });
    const attachment = await uploadRes.json() as { id: string; width: number; height: number };

    await fetch(`http://localhost:${port}/api/review/${reviewId}/annotations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{
        id: "a1", number: 1, imageIndex: 0, pin: { x: 50, y: 50 }, comment: "big review",
        attachments: [attachment],
      }]),
    });
    await fetch(`http://localhost:${port}/api/review/${reviewId}/finalize`, { method: "POST" });
    expect(await reviewCli.exited).toBe(0);

    const shareCli = spawnCli(["share", reviewId, "--server", mock.baseUrl]);
    const link = await waitForLink(() => shareCli.stdout);
    expect(await shareCli.exited).toBe(0);
    expect(link).toContain("/s#t=b&");
    expect(mock.uploadCount).toBe(1);

    const openCli = spawnCli(["open", link, "--mode", "new"]);
    const { port: openPort, reviewId: openedId } = await waitForReady(() => openCli.stderr);

    const review = await (await fetch(`http://localhost:${openPort}/api/review/${openedId}`)).json() as {
      context: string;
      annotations: Array<{ comment: string; attachments?: Array<{ id: string }> }>;
    };
    expect(review.context).toBe("blob-share");
    expect(review.annotations[0].comment).toBe("big review");
    expect(review.annotations[0].attachments).toHaveLength(1);

    await fetch(`http://localhost:${openPort}/api/review/${openedId}/finalize`, { method: "POST" });
    expect(await openCli.exited).toBe(0);
  }, 20000);

  it("open exits with a clear error when the blob link has expired", async () => {
    const fragment = new URLSearchParams({ t: "b", d: `${mock.baseUrl}/blobs/missing`, k: "hello" });
    const cli = spawnCli(["open", `${mock.baseUrl}/s#${fragment.toString()}`]);
    const code = await cli.exited;
    expect(code).toBe(1);
  }, 10000);

  it("respects PINPOINT_SHARE_URL as the default --server", async () => {
    const reviewCli = spawnCli(["review", imagePath]);
    const { port, reviewId } = await waitForReady(() => reviewCli.stderr);
    await fetch(`http://localhost:${port}/api/review/${reviewId}/finalize`, { method: "POST" });
    await reviewCli.exited;

    const shareCli = spawnCli(["share", reviewId], { PINPOINT_SHARE_URL: mock.baseUrl });
    const link = await waitForLink(() => shareCli.stdout);
    expect(link.startsWith(mock.baseUrl)).toBe(true);
  }, 10000);
});
