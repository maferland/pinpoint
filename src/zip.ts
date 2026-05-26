/**
 * Minimal zip writer/reader supporting "stored" entries only (no compression).
 * Sufficient for bundling already-compressed image bytes alongside a JSON
 * manifest without pulling in a zip dependency.
 *
 * Format reference: APPNOTE.TXT (PKZip), sections 4.3.7 (local file header),
 * 4.3.12 (central directory), 4.3.16 (end of central directory).
 */

const SIG_LFH = 0x04034b50;
const SIG_CDH = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const METHOD_STORED = 0;
const FLAG_UTF8 = 0x0800;
const VERSION = 20;

export interface ZipEntry {
  name: string;
  data: Buffer;
}

let crcTable: Uint32Array | null = null;
function crc32(buf: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    (Math.floor(d.getSeconds() / 2) & 0x1f);
  const date =
    (((d.getFullYear() - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0xf) << 5) |
    (d.getDate() & 0x1f);
  return { time, date };
}

export function writeZip(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  const { time, date } = dosDateTime(new Date());
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf-8");
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(SIG_LFH, 0);
    lfh.writeUInt16LE(VERSION, 4);
    lfh.writeUInt16LE(FLAG_UTF8, 6);
    lfh.writeUInt16LE(METHOD_STORED, 8);
    lfh.writeUInt16LE(time, 10);
    lfh.writeUInt16LE(date, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(size, 18);
    lfh.writeUInt32LE(size, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    parts.push(lfh, nameBuf, entry.data);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(SIG_CDH, 0);
    cdh.writeUInt16LE(VERSION, 4);
    cdh.writeUInt16LE(VERSION, 6);
    cdh.writeUInt16LE(FLAG_UTF8, 8);
    cdh.writeUInt16LE(METHOD_STORED, 10);
    cdh.writeUInt16LE(time, 12);
    cdh.writeUInt16LE(date, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(size, 20);
    cdh.writeUInt32LE(size, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);
    central.push(cdh, nameBuf);

    offset += lfh.length + nameBuf.length + size;
  }

  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, cdBuf, eocd]);
}

export function readZip(buf: Buffer): ZipEntry[] {
  // Search backwards for the EOCD signature. Comment can be up to 65535 bytes.
  const minStart = Math.max(0, buf.length - 65557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= minStart; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a zip file (no end-of-central-directory)");

  const numEntries = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  let p = cdOffset;
  for (let i = 0; i < numEntries; i++) {
    if (buf.readUInt32LE(p) !== SIG_CDH) throw new Error("Bad central directory entry");
    const method = buf.readUInt16LE(p + 10);
    if (method !== METHOD_STORED) throw new Error(`Unsupported compression method: ${method}`);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf-8");
    p += 46 + nameLen + extraLen + commentLen;

    if (buf.readUInt32LE(localOffset) !== SIG_LFH) throw new Error("Bad local file header");
    const lfhNameLen = buf.readUInt16LE(localOffset + 26);
    const lfhExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lfhNameLen + lfhExtraLen;
    entries.push({ name, data: buf.subarray(dataStart, dataStart + size) });
  }
  return entries;
}
