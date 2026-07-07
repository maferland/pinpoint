import type { IncomingMessage, ServerResponse } from "http";
import { put } from "@vercel/blob";

// Bundles too big for this should use the inline URL-fragment tier instead (src/share-transport.ts).
const MAX_BYTES = 4 * 1024 * 1024;
const DEFAULT_TTL_DAYS = 14;

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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  let body: Buffer;
  try {
    body = await readBody(req);
  } catch (err) {
    res.statusCode = 413;
    res.end(err instanceof Error ? err.message : "Payload too large");
    return;
  }

  const url = new URL(req.url ?? "", "http://localhost");
  const ttlDays = Number(url.searchParams.get("ttlDays")) || DEFAULT_TTL_DAYS;
  const expiresAt = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  // Expiry timestamp lives in the path so cleanup.ts can sweep without a separate database.
  const pathname = `share/${expiresAt}-${crypto.randomUUID()}.bin`;

  const blob = await put(pathname, body, {
    access: "public",
    contentType: "application/octet-stream",
  });

  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ url: blob.url }));
}
