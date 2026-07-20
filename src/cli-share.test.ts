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

// In-memory stand-in for the Supabase relay: the four security-definer RPCs over one
// shares table, keyed by client-generated share id (see supabase/migrations).
function startMockRelay(): Promise<{ baseUrl: string; close: () => Promise<void>; createShareCount: number }> {
  const rows = new Map<string, { bundle?: string; response?: string }>();
  const state = { createShareCount: 0 };
  const server = http.createServer((req, res) => {
    const rpc = req.url?.match(/^\/rest\/v1\/rpc\/(\w+)$/)?.[1];
    if (req.method !== "POST" || !rpc) { res.writeHead(404); res.end("not found"); return; }
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as {
        share_id: string; bundle?: string; resp?: string;
      };
      const row = rows.get(body.share_id) ?? {};
      if (rpc === "create_share") {
        state.createShareCount++;
        rows.set(body.share_id, { ...row, bundle: body.bundle });
        res.writeHead(204); res.end(); return;
      }
      if (rpc === "put_response") {
        rows.set(body.share_id, { ...row, response: body.resp });
        res.writeHead(204); res.end(); return;
      }
      if (rpc === "get_bundle") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(row.bundle ?? null)); return;
      }
      if (rpc === "get_response") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(row.response ?? null)); return;
      }
      res.writeHead(404); res.end("unknown rpc");
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
        get createShareCount() { return state.createShareCount; },
      });
    });
  });
}

describe("pinpoint share/open cli", () => {
  let dir: string;
  let imagePath: string;
  let relay: Awaited<ReturnType<typeof startMockRelay>>;
  let relayEnv: Record<string, string>;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "pinpoint-cli-share-test-"));
    imagePath = path.join(dir, "test.png");
    fs.writeFileSync(imagePath, TEST_PNG);
    relay = await startMockRelay();
    relayEnv = { PINPOINT_SUPABASE_URL: relay.baseUrl, PINPOINT_SHARE: "1" };
  });

  afterEach(async () => {
    fs.rmSync(dir, { recursive: true, force: true });
    await relay.close();
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

    const shareCli = spawnCli(["share", reviewId], relayEnv);
    const link = await waitForLink(() => shareCli.stdout);
    expect(await shareCli.exited).toBe(0);
    expect(link).toContain("/s#t=i&");
    expect(relay.createShareCount).toBe(0);

    const openCli = spawnCli(["open", link, "--mode", "new"], relayEnv);
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

    const shareCli = spawnCli(["share", reviewId], relayEnv);
    const link = await waitForLink(() => shareCli.stdout);
    expect(await shareCli.exited).toBe(0);
    expect(link).toContain("/s#t=s&");
    expect(relay.createShareCount).toBe(1);

    const openCli = spawnCli(["open", link, "--mode", "new"], relayEnv);
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

  it("open exits with a clear error when the shared review has expired", async () => {
    const fragment = new URLSearchParams({ t: "s", k: "hello", s: "does-not-exist", rk: "x" });
    const cli = spawnCli(["open", `https://example.test/s#${fragment.toString()}`], relayEnv);
    const code = await cli.exited;
    expect(code).toBe(1);
  }, 10000);

  it("share is inert unless PINPOINT_SHARE=1", async () => {
    const reviewCli = spawnCli(["review", imagePath]);
    const { port, reviewId } = await waitForReady(() => reviewCli.stderr);
    await fetch(`http://localhost:${port}/api/review/${reviewId}/finalize`, { method: "POST" });
    await reviewCli.exited;

    const shareCli = spawnCli(["share", reviewId], { PINPOINT_SUPABASE_URL: relay.baseUrl });
    const code = await shareCli.exited;
    expect(code).toBe(2);
    expect(shareCli.stdout.trim()).toBe("");
    expect(relay.createShareCount).toBe(0);
  }, 10000);

  it("respects PINPOINT_SHARE_URL as the default link host", async () => {
    const reviewCli = spawnCli(["review", imagePath]);
    const { port, reviewId } = await waitForReady(() => reviewCli.stderr);
    await fetch(`http://localhost:${port}/api/review/${reviewId}/finalize`, { method: "POST" });
    await reviewCli.exited;

    const host = "https://share.example.test";
    const shareCli = spawnCli(["share", reviewId], { ...relayEnv, PINPOINT_SHARE_URL: host });
    const link = await waitForLink(() => shareCli.stdout);
    expect(link.startsWith(host)).toBe(true);
  }, 10000);
});
