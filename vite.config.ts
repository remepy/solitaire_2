import path from "node:path";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Every URL in the bundle is relative ("./"), so one build works from any
// folder, e.g. https://<cdn>/games/solitaire/<lang>/ (bridge spec §4.1).
// scripts/build-web.mjs sets OUT_DIR per language.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  build: {
    outDir: process.env.OUT_DIR ?? "dist/tmp",
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  server: { host: true },
});
