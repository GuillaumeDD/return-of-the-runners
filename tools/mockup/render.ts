/**
 * Renders the B-030 mockups to docs/screenshots/: `node tools/mockup/render.ts`.
 * Starts Vite on this folder and takes one Chromium screenshot per style and world.
 */
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));
const out = fileURLToPath(new URL("../../docs/screenshots/", import.meta.url));
const only = process.argv.slice(2);

const server = await createServer({ root, server: { port: 5199 }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const hiDpi = await browser.newPage({
    deviceScaleFactor: 2,
    viewport: { width: 1000, height: 700 },
  });
  for (const style of ["pixel", "diorama", "glow"]) {
    for (const world of ["moss", "lava"]) {
      const name = `b-030-${style}-${world}`;
      if (only.length > 0 && !only.some((o) => name.includes(o))) continue;
      await page.goto(`http://localhost:5199/?style=${style}&world=${world}`);
      await page.waitForSelector("body[data-done]");
      await page.locator("#mockup").screenshot({ path: `${out}${name}.png` });
      console.log(name);
    }
    // A close-up at device pixel ratio 2, to judge actors and items.
    const name = `b-030-${style}-detail`;
    if (only.length > 0 && !only.some((o) => name.includes(o))) continue;
    await hiDpi.goto(`http://localhost:5199/?style=${style}&world=moss&scale=2`);
    await hiDpi.waitForSelector("body[data-done]");
    // Columns 12 to 23, rows 6 to 12 of the playfield (16 px frame, 32 px cells).
    await hiDpi.screenshot({
      path: `${out}${name}.png`,
      clip: { x: 16 + 12 * 32, y: 16 + 6 * 32, width: 12 * 32, height: 7 * 32 },
    });
    console.log(name);
  }
} finally {
  await browser.close();
  await server.close();
}
