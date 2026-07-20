import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import pkg from "./package.json" with { type: "json" };

const isDevelopment = process.env.NODE_ENV === "development";

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __SHARE_ENABLED__: JSON.stringify(process.env.PINPOINT_SHARE === "1"),
  },
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: {
      input: path.resolve(__dirname, "src/annotator.html"),
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
