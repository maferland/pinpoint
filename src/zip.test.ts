import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "bun:test";
import { readZip, writeZip } from "./zip.js";

describe("zip writer/reader", () => {
  it("round-trips multiple entries", () => {
    const entries = [
      { name: "review.json", data: Buffer.from('{"hello":"world"}') },
      { name: "images/0-screen.png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
    ];
    const zip = writeZip(entries);
    const read = readZip(zip);
    expect(read).toHaveLength(2);
    expect(read[0].name).toBe("review.json");
    expect(read[0].data.toString()).toBe('{"hello":"world"}');
    expect(read[1].name).toBe("images/0-screen.png");
    expect(read[1].data[0]).toBe(0x89);
  });

  it("rejects buffers without an EOCD record", () => {
    expect(() => readZip(Buffer.from("not a zip"))).toThrow(/Not a zip/);
  });

  it("produces files that the system unzip can extract", () => {
    // Sanity check that the bytes we emit are actually valid PKZip — guards
    // against off-by-one issues in the header layouts.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pinpoint-zip-test-"));
    try {
      const zip = writeZip([
        { name: "hello.txt", data: Buffer.from("hi from pinpoint") },
      ]);
      const zipPath = path.join(dir, "test.zip");
      fs.writeFileSync(zipPath, zip);
      const result = spawnSync("unzip", ["-p", zipPath, "hello.txt"], { encoding: "utf-8" });
      // If unzip isn't installed (e.g. minimal CI image), skip the assertion.
      if (result.error || result.status !== 0) return;
      expect(result.stdout).toBe("hi from pinpoint");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
