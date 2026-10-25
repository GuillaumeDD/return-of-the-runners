import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Builds the replay harness with the game's build settings (see ../vite.config.ts).
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  build: {
    target: "es2022",
    outDir: fileURLToPath(new URL("../dist-e2e", import.meta.url)),
    emptyOutDir: true,
    rolldownOptions: { input: fileURLToPath(new URL("harness.html", import.meta.url)) },
  },
  preview: { port: 4179, strictPort: true },
});
