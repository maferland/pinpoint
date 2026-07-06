import path from "path";
import fs from "fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function moveEntryHtml(): Plugin {
  return {
    name: "move-entry-html",
    closeBundle() {
      const moves: Array<[string, string]> = [
        ["site/src/landing.html", "site/index.html"],
        ["site/src/try.html", "site/try.html"],
      ];
      for (const [from, to] of moves) {
        const src = path.resolve(__dirname, from);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.resolve(__dirname, to));
      }
      fs.rmSync(path.resolve(__dirname, "site/src"), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), moveEntryHtml()],
  publicDir: path.resolve(__dirname, "site"),
  build: {
    rollupOptions: {
      input: [
        path.resolve(__dirname, "src/landing.html"),
        path.resolve(__dirname, "src/try.html"),
      ],
    },
    outDir: "site",
    emptyOutDir: false,
    cssMinify: true,
    minify: true,
  },
});
