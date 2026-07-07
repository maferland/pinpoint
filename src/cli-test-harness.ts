import { spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";

export const CLI_PATH = path.join(import.meta.dirname!, "..", "dist", "cli.js");

export function ensureCliBuilt(): void {
  if (fs.existsSync(CLI_PATH)) return;
  // Self-build if dist is missing — keeps `bun test` working without a
  // separate `bun run build` step (and avoids a CI ordering footgun).
  const result = spawnSync("bun", ["run", "build"], {
    cwd: path.join(import.meta.dirname!, ".."),
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("build failed");
}

export const TEST_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64,
  0x08, 0x02, 0x00, 0x00, 0x00,
]);

export function spawnCli(args: string[], env: Record<string, string | undefined> = {}) {
  const proc = spawn("node", [CLI_PATH, ...args], {
    env: { ...process.env, PINPOINT_TEST_NO_OPEN: "1", ...env },
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

export async function waitForReady(getStderr: () => string, timeoutMs = 5000): Promise<{ port: number; reviewId: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const m = getStderr().match(/http:\/\/localhost:(\d+)\/review\/([a-zA-Z0-9_-]+)/);
    if (m) return { port: parseInt(m[1], 10), reviewId: m[2] };
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`cli not ready in ${timeoutMs}ms: ${getStderr()}`);
}
