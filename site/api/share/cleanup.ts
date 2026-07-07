import type { IncomingMessage, ServerResponse } from "http";
import { del, list } from "@vercel/blob";

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { blobs } = await list({ prefix: "share/" });
  const now = Date.now();

  const expired = blobs.filter((blob) => {
    const match = blob.pathname.match(/^share\/(\d+)-/);
    const expiresAt = match ? Number(match[1]) : 0;
    return now > expiresAt;
  });

  if (expired.length > 0) {
    await del(expired.map((blob) => blob.url));
  }

  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ deleted: expired.length, remaining: blobs.length - expired.length }));
}
