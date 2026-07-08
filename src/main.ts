// Pinpoint HTTP server: serves the annotation UI and its REST API. Usage: bun src/main.ts

import fs from "fs";
import http from "http";
import path from "path";
import { FileReviewStore } from "./store.js";
import { PreferencesStore, type Preferences } from "./preferences.js";
import { importBundleIntoStore, parseBundle, serialize } from "./export.js";
import { REVIEW_ID_RE } from "./util.js";
import { sniffMimeType } from "./image-sniff.js";
import { decryptBundle, encryptBundle } from "./share-crypto.js";
import {
  buildInlineLink,
  buildSupabaseLink,
  createShare,
  DEFAULT_SHARE_BASE_URL,
  downloadResponse,
  generateResponseChannel,
  type ResponseChannel,
  shouldInline,
} from "./share-transport.js";
import type { PinpointAnnotation } from "./types.js";

const DEFAULT_SHARE_TTL_DAYS = 14;
const REMOTE_POLL_INTERVAL_MS = 3000;

const DIST_DIR = import.meta.filename?.endsWith(".ts")
  ? path.join(import.meta.dirname!, "..", "dist")
  : import.meta.dirname!;

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};
const MAX_BODY = 1024 * 1024;
const MAX_ATTACHMENT_BODY = 8 * 1024 * 1024;

type RouteHandler = (
  reviewId: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
) => Promise<void>;

export interface PinpointHttpServer {
  server: http.Server;
  waitForFinalize(reviewId: string): Promise<void>;
}

function json(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function createHttpServer(
  store: FileReviewStore,
  port: number,
  prefs: PreferencesStore = new PreferencesStore(),
  shareBaseUrl: string = process.env.PINPOINT_SHARE_URL ?? DEFAULT_SHARE_BASE_URL
): PinpointHttpServer {
  const finalizeResolvers = new Map<string, () => void>();

  function finalize(reviewId: string): void {
    const resolver = finalizeResolvers.get(reviewId);
    if (!resolver) return;
    finalizeResolvers.delete(reviewId);
    resolver();
  }

  // Armed by /api/review/:id/share so both the in-app Share button and `pinpoint review --share` complete the same way.
  async function pollForResponse(reviewId: string, channel: ResponseChannel): Promise<void> {
    while (finalizeResolvers.has(reviewId)) {
      await new Promise((r) => setTimeout(r, REMOTE_POLL_INTERVAL_MS));
      if (!finalizeResolvers.has(reviewId)) return;

      let responsePayload: Uint8Array | null;
      try {
        responsePayload = await downloadResponse(channel.shareId);
      } catch {
        continue;
      }
      if (!responsePayload) continue;

      const existing = await store.load(reviewId);
      if (!existing || !finalizeResolvers.has(reviewId)) return;
      const decrypted = await decryptBundle(responsePayload, channel.responseKey);
      const bundle = parseBundle(Buffer.from(decrypted));
      // The response bundle is the reviewer's full intended state (originals + their additions), so replace rather than append to avoid duplicating originals.
      await importBundleIntoStore(bundle, "replace", existing, store);
      finalize(reviewId);
      return;
    }
  }

  const routes: Record<string, RouteHandler> = {
    "GET /review": async (_id, _req, res) => {
      const html = await fs.promises.readFile(path.join(DIST_DIR, "annotator.html"), "utf-8");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    },

    "GET /api/review": async (id, _req, res) => {
      const review = await store.load(id);
      if (!review) return json(res, 404, { error: "Review not found" });
      json(res, 200, review);
    },

    "GET /api/review/image": async (id, req, res) => {
      const review = await store.load(id);
      if (!review) { res.writeHead(404); res.end("Not found"); return; }

      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      const index = parseInt(url.searchParams.get("index") ?? "0", 10);
      const img = review.images[index];
      if (!img) { res.writeHead(404); res.end("Image index out of range"); return; }

      const ext = path.extname(img.path).toLowerCase();
      const stream = fs.createReadStream(img.path);
      stream.on("error", () => {
        if (!res.headersSent) res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Image not found");
      });
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream" });
      stream.pipe(res);
    },

    "POST /api/review/attachments": async (id, req, res) => {
      const review = await store.load(id);
      if (!review) return json(res, 404, { error: "Review not found" });

      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > MAX_ATTACHMENT_BODY) return json(res, 413, { error: "Payload too large" });
        chunks.push(chunk as Buffer);
      }

      const attachment = await store.saveAttachment(id, Buffer.concat(chunks));
      json(res, 200, attachment);
    },

    "GET /api/review/attachments": async (id, req, res) => {
      const review = await store.load(id);
      if (!review) return json(res, 404, { error: "Review not found" });

      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      const attachmentId = url.searchParams.get("id") ?? "";
      try {
        const buf = await fs.promises.readFile(store.attachmentPath(id, attachmentId));
        res.writeHead(200, { "Content-Type": sniffMimeType(buf) });
        res.end(buf);
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Attachment not found");
      }
    },

    "DELETE /api/review/attachments": async (id, req, res) => {
      const review = await store.load(id);
      if (!review) return json(res, 404, { error: "Review not found" });

      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      const attachmentId = url.searchParams.get("id") ?? "";
      try {
        await store.deleteAttachment(id, attachmentId);
        json(res, 200, { ok: true });
      } catch {
        json(res, 400, { error: "Invalid attachment id" });
      }
    },

    "PUT /api/review/annotations": async (id, req, res) => {
      const review = await store.load(id);
      if (!review) return json(res, 404, { error: "Review not found" });

      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > MAX_BODY) return json(res, 413, { error: "Payload too large" });
        chunks.push(chunk as Buffer);
      }

      try {
        review.annotations = JSON.parse(Buffer.concat(chunks).toString()) as PinpointAnnotation[];
        await store.save(review);
        json(res, 200, { ok: true });
      } catch {
        json(res, 400, { error: "Invalid JSON" });
      }
    },

    "GET /api/review/export": async (id, _req, res) => {
      const review = await store.load(id);
      if (!review) return json(res, 404, { error: "Review not found" });
      try {
        const zip = await serialize(review, store);
        res.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${id}.pinpoint.zip"`,
          "Content-Length": String(zip.length),
        });
        res.end(zip);
      } catch (err) {
        json(res, 500, { error: err instanceof Error ? err.message : "Export failed" });
      }
    },

    "POST /api/review/share": async (id, req, res) => {
      const review = await store.load(id);
      if (!review) return json(res, 404, { error: "Review not found" });

      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > MAX_BODY) return json(res, 413, { error: "Payload too large" });
        chunks.push(chunk as Buffer);
      }
      const body = chunks.length > 0 ? (JSON.parse(Buffer.concat(chunks).toString()) as { ttlDays?: number }) : {};
      const ttlDays = body.ttlDays ?? DEFAULT_SHARE_TTL_DAYS;

      try {
        const zip = await serialize(review, store);
        const { payload, key } = await encryptBundle(zip);
        const channel = generateResponseChannel();
        let link: string;
        if (shouldInline(payload)) {
          link = buildInlineLink(payload, key, channel, shareBaseUrl);
        } else {
          await createShare(channel.shareId, payload, { ttlDays });
          link = buildSupabaseLink(key, channel, shareBaseUrl);
        }
        pollForResponse(id, channel).catch((err) => console.error(`Response check failed for ${id}:`, err));
        json(res, 200, { link, ttlDays });
      } catch (err) {
        json(res, 500, { error: err instanceof Error ? err.message : "Share failed" });
      }
    },

    "POST /api/review/finalize": async (id, _req, res) => {
      const review = await store.load(id);
      if (!review) return json(res, 404, { error: "Review not found" });
      finalize(id);
      json(res, 200, { ok: true });
    },
  };

  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (url.pathname === "/api/preferences") {
      if (req.method === "GET") return json(res, 200, await prefs.load());
      if (req.method === "PUT") {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += (chunk as Buffer).length;
          if (size > MAX_BODY) return json(res, 413, { error: "Payload too large" });
          chunks.push(chunk as Buffer);
        }
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString()) as Partial<Preferences>;
          return json(res, 200, await prefs.save(body));
        } catch {
          return json(res, 400, { error: "Invalid JSON" });
        }
      }
      res.writeHead(405); res.end("Method not allowed"); return;
    }

    const idMatch = url.pathname.match(REVIEW_ID_RE);
    if (!idMatch) { res.writeHead(404); res.end("Not found"); return; }

    const reviewId = idMatch[1];
    const suffix = url.pathname.endsWith("/image") ? "/image"
      : url.pathname.endsWith("/attachments") ? "/attachments"
      : url.pathname.endsWith("/annotations") ? "/annotations"
      : url.pathname.endsWith("/finalize") ? "/finalize"
      : url.pathname.endsWith("/export") ? "/export"
      : url.pathname.endsWith("/share") ? "/share"
      : "";
    const routeKey = url.pathname.startsWith("/api/")
      ? `${req.method} /api/review${suffix}`
      : `${req.method} /review`;

    const handler = routes[routeKey];
    if (!handler) { res.writeHead(404); res.end("Not found"); return; }
    await handler(reviewId, req, res);
  });

  server.listen(port, () => {
    const addr = server.address();
    const boundPort = typeof addr === "object" && addr ? addr.port : port;
    process.stderr.write(`Pinpoint annotation UI: http://localhost:${boundPort}\n`);
  });

  return {
    server,
    waitForFinalize(reviewId) {
      return new Promise<void>((resolve) => {
        finalizeResolvers.set(reviewId, resolve);
      });
    },
  };
}

async function main() {
  const store = new FileReviewStore();
  const httpPort = parseInt(process.env.PINPOINT_PORT ?? "4747", 10);
  const { server: httpServer } = createHttpServer(store, httpPort);

  const shutdown = () => httpServer.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (import.meta.main) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
