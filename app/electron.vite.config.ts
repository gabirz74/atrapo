import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    // archiver 8 is ESM-only, so it is bundled instead of required at runtime.
    build: { externalizeDeps: { exclude: ["archiver"] } },
    resolve: { alias: { "@shared": resolve("src/shared") } },
  },
  preload: {
    resolve: { alias: { "@shared": resolve("src/shared") } },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": resolve("src/renderer/src"), "@shared": resolve("src/shared") } },
  },
});
