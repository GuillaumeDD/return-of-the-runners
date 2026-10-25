import { defineConfig, devices } from "@playwright/test";

// Replay determinism in real browser engines (BACKLOG B-010): Blink/V8, Gecko/
// SpiderMonkey and WebKit/JavaScriptCore. Run one with `--project chromium`.
export default defineConfig({
  testDir: ".",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:4179/" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "npx vite build -c e2e/vite.config.ts && npx vite preview -c e2e/vite.config.ts",
    cwd: "..",
    url: "http://localhost:4179/harness.html",
    // Always rebuild: a reused server would serve a stale harness.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
