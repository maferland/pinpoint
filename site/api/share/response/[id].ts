import type { IncomingMessage, ServerResponse } from "http";
import { list, put } from "@vercel/blob";

const MAX_BYTES = 4 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        req.destroy();
        reject(new Error(`Payload too large (max ${MAX_BYTES} bytes)`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function shareIdFromUrl(req: IncomingMessage): string | null {
  return (req.url ?? "").match(/\/api\/share\/response\/([a-zA-Z0-9]+)/)?.[1] ?? null;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const shareId = shareIdFromUrl(req);
  if (!shareId) {
    res.statusCode = 400;
    res.end("Missing share id");
    return;
  }
  const pathname = `response/${shareId}.bin`;

  if (req.method === "PUT") {
    let body: Buffer;
    try {
      body = await readBody(req);
    } catch (err) {
      res.statusCode = 413;
      res.end(err instanceof Error ? err.message : "Payload too large");
      return;
    }
    await put(pathname, body, { access: "public", addRandomSuffix: false, contentType: "application/octet-stream" });
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "GET") {
    const { blobs } = await list({ prefix: pathname });
    if (blobs.length === 0) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const upstream = await fetch(blobs[0].url);
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("content-type", "application/octet-stream");
    res.end(bytes);
    return;
  }

  res.statusCode = 405;
  res.end("Method not allowed");
}
