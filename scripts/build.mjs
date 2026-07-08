#!/usr/bin/env bun
import { execSync } from "child_process";
import { mkdirSync, renameSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

rmSync(join(root, "dist"), { recursive: true, force: true });
rmSync(join(root, "dist-share-view"), { recursive: true, force: true });

run("bunx tsc --noEmit");
run("bunx vite build");
run("bunx vite build --config vite.share-view.config.ts");

renameSync(
  join(root, "dist", "src", "annotator.html"),
  join(root, "dist", "annotator.html")
);
rmSync(join(root, "dist", "src"), { recursive: true, force: true });

mkdirSync(join(root, "site", "s"), { recursive: true });
renameSync(
  join(root, "dist-share-view", "src", "share-view.html"),
  join(root, "site", "s", "index.html")
);
rmSync(join(root, "dist-share-view"), { recursive: true, force: true });

run('bun build src/cli.ts --outfile dist/cli.js --target node --banner "#!/usr/bin/env node"');
