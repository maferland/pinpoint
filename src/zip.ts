import { unzipSync, zipSync } from "fflate";

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

// level: 0 (store, no compression) — entries are already-compressed images or small JSON, so deflate buys nothing.
export function writeZip(entries: ZipEntry[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const entry of entries) files[entry.name] = entry.data;
  return zipSync(files, { level: 0 });
}

export function readZip(bytes: Uint8Array): ZipEntry[] {
  const files = unzipSync(bytes);
  return Object.entries(files).map(([name, data]) => ({ name, data }));
}
