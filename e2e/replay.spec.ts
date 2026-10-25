import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { runReplay } from "../src/sim/replay";
import { fixturesFrom } from "../tests/helpers/replay-fixture";
import "./harness-types";

const dir = new URL("../tests/fixtures/replays/", import.meta.url);
const fixtures = fixturesFrom(
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => [f, readFileSync(new URL(f, dir), "utf8")] as const),
);

test("committed replays reach the same hashes in the browser as in Node", async ({ page }) => {
  await page.goto("/harness.html");
  await page.waitForFunction(() => window.replayResults ?? window.replayError);
  expect(await page.evaluate(() => window.replayError)).toBeUndefined();
  const browser = (await page.evaluate(() => window.replayResults)) ?? [];

  expect(browser.map((r) => r.name)).toEqual(fixtures.map((f) => f.name));
  for (const f of fixtures) {
    const node = runReplay(f.replay);
    const inBrowser = browser.find((r) => r.name === f.name);
    // Every checkpoint (one per simulated second), not only the end state.
    expect(inBrowser?.checkpoints, f.name).toEqual(node.checkpoints);
    expect({
      tick: inBrowser?.tick,
      status: inBrowser?.status,
      hash: inBrowser?.checkpoints.at(-1),
    }).toEqual(f.expected);
  }
});
