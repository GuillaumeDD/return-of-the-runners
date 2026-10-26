import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { parseLevel } from "../src/level/parse";
import { decodeLevel, encodeLevel, toBase64url } from "../src/share/link";
import { loadFixtures } from "../tests/level/fixtures";
import "./harness-types";

const firstSteps = readFileSync(new URL("../src/levels/first-steps.json", import.meta.url), "utf8");
const texts = [firstSteps, ...loadFixtures("valid").map((f) => f.text)];

function level(text: string) {
  const r = parseLevel(text);
  if (!r.ok) throw new Error(r.errors.map((e) => e.code).join());
  return r.level;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/share.html");
  await page.waitForFunction(() => window.shareDecode !== undefined);
});

test("links made in Node open in the browser with the same level (name and grid)", async ({
  page,
}) => {
  for (const text of texts) {
    const payload = await encodeLevel(level(text));
    const opened = await page.evaluate((p) => window.shareDecode?.(p), payload);
    expect(opened).toEqual({ ok: true, level: level(text) });
  }
});

test("links made in the browser open in Node with the same level", async ({ page }) => {
  for (const text of texts) {
    const payload = await page.evaluate((t) => window.shareEncode?.(t), text);
    const opened = await decodeLevel(payload ?? "");
    expect(opened.ok && opened.level).toEqual(level(text));
  }
});

test("the browser rejects a cut link and a zip bomb like Node", async ({ page }) => {
  const payload = await encodeLevel(level(firstSteps));
  const cut = payload.slice(0, (payload.length >> 3) << 2);
  const bomb = toBase64url(deflateRawSync(Buffer.alloc(10 * 1024 * 1024, 0x20)));
  for (const [p, code] of [
    [cut, "not-deflate"],
    [bomb, "too-large"],
  ] as const) {
    expect(await page.evaluate((x) => window.shareDecode?.(x), p)).toEqual({
      ok: false,
      codes: [code],
    });
  }
});
