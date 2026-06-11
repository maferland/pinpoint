/**
 * Pinpoint CLI — opens images for annotation, blocks until the user clicks Done,
 * then prints the structured feedback as JSON on stdout.
 *
 * Usage:
 *   pinpoint review <image>... [--context "..."] [--port N]
 *   pinpoint export <reviewId> [--output FILE]
 *   pinpoint open <bundle.pinpoint.zip> [--mode replace|append|new] [--port N]
 *   pinpoint demo [--port N]
 */

import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { FileReviewStore } from "./store.js";
import { createHttpServer } from "./main.js";
import { readImageDimensions } from "./server.js";
import { deserialize, parseBundle, serialize, type MergeMode } from "./export.js";
import { generateId, openBrowser } from "./util.js";
import type { ImageInfo, PinpointReview } from "./types.js";

const FINALIZE_TIMEOUT_MS = 96 * 60 * 60 * 1000;

interface ParsedArgs {
  command: string;
  positional: string[];
  context?: string;
  output?: string;
  mode?: MergeMode;
  port: number;
  compare?: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positional: string[] = [];
  let context: string | undefined;
  let output: string | undefined;
  let mode: MergeMode | undefined;
  let port = parseInt(process.env.PINPOINT_PORT ?? "0", 10);

  let compare: boolean | undefined;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--context") { context = rest[++i]; continue; }
    if (arg === "--port") { port = parseInt(rest[++i], 10); continue; }
    if (arg === "--output" || arg === "-o") { output = rest[++i]; continue; }
    if (arg === "--compare") { compare = true; continue; }
    if (arg === "--mode") {
      const m = rest[++i];
      if (m !== "replace" && m !== "append" && m !== "new") {
        process.stderr.write(`Invalid --mode: ${m} (expected replace|append|new)\n`);
        process.exit(2);
      }
      mode = m;
      continue;
    }
    if (arg.startsWith("--")) {
      process.stderr.write(`Unknown flag: ${arg}\n`);
      process.exit(2);
    }
    positional.push(arg);
  }

  return { command, positional, context, output, mode, port, compare };
}

function reviewToOutput(final: PinpointReview): object {
  const images = final.images.map((img) => ({ path: img.path, width: img.width, height: img.height }));
  const annotations = final.annotations.map((a) => ({
    number: a.number,
    image: final.images[a.imageIndex]?.path,
    imageIndex: a.imageIndex,
    ...(final.compareMode ? { side: a.imageIndex === 0 ? "before" : "after" } : {}),
    pin: a.pin,
    box: a.box,
    comment: a.comment,
  }));

  if (final.compareMode) {
    return {
      mode: "compare",
      context: final.context,
      comparison: {
        before: images[0],
        after: images[1],
      },
      images,
      annotations,
    };
  }

  return { context: final.context, images, annotations };
}

async function runAnnotationSession(
  store: FileReviewStore,
  reviewId: string,
  port: number
): Promise<void> {
  const { server, waitForFinalize } = createHttpServer(store, port);
  await new Promise<void>((resolve) => server.on("listening", resolve));
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  const url = `http://localhost:${actualPort}/review/${reviewId}`;

  process.stderr.write(`Opening ${url}\n`);
  openBrowser(url);

  const timeout = setTimeout(() => {
    process.stderr.write("Timed out waiting for annotations.\n");
    process.exit(1);
  }, FINALIZE_TIMEOUT_MS);

  await waitForFinalize(reviewId);
  clearTimeout(timeout);

  const final = await store.load(reviewId);
  if (!final) {
    process.stderr.write("Review disappeared before finalize.\n");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(reviewToOutput(final), null, 2) + "\n");
  server.closeAllConnections?.();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 250).unref();
}

async function reviewCommand(args: ParsedArgs): Promise<void> {
  if (args.positional.length === 0) {
    process.stderr.write("usage: pinpoint review <image>... [--context \"...\"] [--compare]\n");
    process.exit(2);
  }

  if (args.compare && args.positional.length !== 2) {
    process.stderr.write("--compare requires exactly 2 images (before and after)\n");
    process.exit(2);
  }

  const resolved: ImageInfo[] = [];
  for (const p of args.positional) {
    const abs = path.resolve(p);
    try {
      const dims = await readImageDimensions(abs);
      resolved.push({ path: abs, ...dims });
    } catch {
      process.stderr.write(`Image not found or unreadable: ${abs}\n`);
      process.exit(1);
    }
  }

  const store = new FileReviewStore();
  const reviewId = generateId();
  const review: PinpointReview = {
    version: "1.0",
    id: reviewId,
    images: resolved,
    context: args.context,
    createdAt: new Date().toISOString(),
    annotations: [],
    ...(args.compare ? { compareMode: true } : {}),
  };
  await store.save(review);

  await runAnnotationSession(store, reviewId, args.port || 0);
}

async function exportCommand(args: ParsedArgs): Promise<void> {
  if (args.positional.length !== 1) {
    process.stderr.write("usage: pinpoint export <reviewId> [--output FILE|-]\n");
    process.exit(2);
  }
  const [reviewId] = args.positional;
  const store = new FileReviewStore();
  const review = await store.load(reviewId);
  if (!review) {
    process.stderr.write(`Review "${reviewId}" not found.\n`);
    process.exit(1);
  }

  const zip = await serialize(review);

  if (args.output === "-") {
    process.stdout.write(zip);
    process.exit(0);
  }
  const outPath = path.resolve(args.output ?? `${reviewId}.pinpoint.zip`);
  await fs.promises.writeFile(outPath, zip);
  process.stderr.write(`Wrote ${outPath} (${zip.length} bytes)\n`);
  process.exit(0);
}

async function promptMode(): Promise<MergeMode> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    while (true) {
      const answer = await new Promise<string>((resolve) => {
        rl.question(
          "A review with this id already exists. [r]eplace, [a]ppend, [n]ew? ",
          resolve
        );
      });
      const c = answer.trim().toLowerCase();
      if (c === "r" || c === "replace") return "replace";
      if (c === "a" || c === "append") return "append";
      if (c === "n" || c === "new") return "new";
      process.stderr.write("Please answer r, a, or n.\n");
    }
  } finally {
    rl.close();
  }
}

async function openCommand(args: ParsedArgs): Promise<void> {
  if (args.positional.length !== 1) {
    process.stderr.write("usage: pinpoint open <bundle.pinpoint.zip> [--mode replace|append|new]\n");
    process.exit(2);
  }
  const filePath = path.resolve(args.positional[0]);
  let raw: Buffer;
  try {
    raw = await fs.promises.readFile(filePath);
  } catch {
    process.stderr.write(`Cannot read bundle: ${filePath}\n`);
    process.exit(1);
  }

  let bundle;
  try {
    bundle = parseBundle(raw);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : err}: ${filePath}\n`);
    process.exit(1);
  }

  const store = new FileReviewStore();
  const existing = await store.load(bundle.manifest.id);

  let mode = args.mode;
  if (!mode) {
    if (existing) {
      if (process.stdin.isTTY) {
        mode = await promptMode();
      } else {
        process.stderr.write(
          `Review "${bundle.manifest.id}" already exists locally. Pass --mode replace|append|new (non-interactive).\n`
        );
        process.exit(2);
      }
    } else {
      mode = "replace";
    }
  }

  const imageDir = path.join(os.tmpdir(), "pinpoint-reviews", `${bundle.manifest.id}-images`);
  const restored = await deserialize({ bundle, imageDir, mode, existing });
  await store.save(restored);

  process.stderr.write(`Imported review "${restored.id}" (mode: ${mode})\n`);
  await runAnnotationSession(store, restored.id, args.port || 0);
}

function resolveDemoBundle(): string {
  // The CLI binary lives at <repo>/dist/cli.js after build, or <repo>/src/cli.ts
  // in dev. Either way the bundle is one level up at <repo>/assets/demo.pinpoint.zip.
  return path.resolve(import.meta.dirname!, "..", "assets", "demo.pinpoint.zip");
}

async function demoCommand(args: ParsedArgs): Promise<void> {
  const bundlePath = resolveDemoBundle();
  if (!fs.existsSync(bundlePath)) {
    process.stderr.write(
      `Demo bundle not found at ${bundlePath}.\n` +
      `Reinstall pinpoint or run from a working checkout of the repo.\n`
    );
    process.exit(1);
  }
  await openCommand({ ...args, positional: [bundlePath], mode: "new" });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "review") return reviewCommand(args);
  if (args.command === "export") return exportCommand(args);
  if (args.command === "open") return openCommand(args);
  if (args.command === "demo") return demoCommand(args);

  process.stderr.write(
    "pinpoint — visual annotation CLI\n\n" +
    "Commands:\n" +
    "  pinpoint review <image>... [--context \"...\"] [--compare] [--port N]\n" +
    "  pinpoint export <reviewId> [--output FILE|-]\n" +
    "  pinpoint open <bundle.pinpoint.zip> [--mode replace|append|new] [--port N]\n" +
    "  pinpoint demo [--port N]\n"
  );
  process.exit(args.command ? 2 : 0);
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
