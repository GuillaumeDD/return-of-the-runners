/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
  // Served from https://<user>.github.io/return-of-the-runners/
  base: "/return-of-the-runners/",
  build: {
    target: "es2022",
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
