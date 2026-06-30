import path from "path";
import fs from "fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function moveLandingHtml(): Plugin {
  return {
    name: "move-landing-html",
    closeBundle() {
      const src = path.resolve(__dirname, "site/src/landing.html");
      const dest = path.resolve(__dirname, "site/index.html");
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        fs.rmSync(path.resolve(__dirname, "site/src"), { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), moveLandingHtml()],
  publicDir: path.resolve(__dirname, "site"),
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, "src/landing.html"),
    },
    outDir: "site",
    emptyOutDir: false,
    cssMinify: true,
    minify: true,
  },
});
