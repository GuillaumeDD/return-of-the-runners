import { describe, expect, it } from "vitest";
import { TILE_CHARS } from "../../src/level/format";
import { parseLevel } from "../../src/level/parse";
import { makeRng, randInt } from "../helpers/rng";
import { loadFixtures } from "./fixtures";
import { expectLevelInvariants } from "./invariants";

const ITERATIONS = 2000;
const valid = loadFixtures("valid").map((f) => JSON.parse(f.text) as Record<string, unknown>);
const tileChars = [...TILE_CHARS, "X", " ", "é", "\u0000"];

function checkNeverThrowsAndAcceptedIsValid(text: string): void {
  let result: ReturnType<typeof parseLevel> | undefined;
  expect(() => (result = parseLevel(text)), text.slice(0, 200)).not.toThrow();
  if (result?.ok) expectLevelInvariants(result.level);
}

describe("parseLevel fuzzing", () => {
  it("random strings: never throws", () => {
    const rng = makeRng(1);
    const alphabet = '{}[]",:0123456789.-truefalsnl #@H$EPM\\ué \n';
    for (let i = 0; i < ITERATIONS; i++) {
      const len = randInt(rng, 200);
      let s = "";
      for (let j = 0; j < len; j++) s += alphabet[randInt(rng, alphabet.length)] ?? "";
      checkNeverThrowsAndAcceptedIsValid(s);
    }
  });

  it("mutated valid levels: never throws, and anything accepted satisfies all invariants", () => {
    const rng = makeRng(2);
    let accepted = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      const doc = structuredClone(valid[randInt(rng, valid.length)]) as Record<string, unknown>;
      const grid = [...(doc.grid as string[])];
      switch (randInt(rng, 7)) {
        case 0: {
          // flip one tile
          const y = randInt(rng, grid.length);
          const row = grid[y] ?? "";
          const x = randInt(rng, row.length);
          grid[y] =
            row.slice(0, x) + (tileChars[randInt(rng, tileChars.length)] ?? ".") + row.slice(x + 1);
          break;
        }
        case 1:
          grid.splice(randInt(rng, grid.length), 1);
          break;
        case 2: {
          const y = randInt(rng, grid.length);
          grid.splice(y, 0, grid[y] ?? "");
          break;
        }
        case 3:
          doc.width = (doc.width as number) + randInt(rng, 5) - 2;
          break;
        case 4:
          doc.height = [0, -1, 1.5, 1e9, "8", null][randInt(rng, 6)];
          break;
        case 5:
          doc.name = ["", "x".repeat(randInt(rng, 100)), 0, null][randInt(rng, 4)];
          break;
        default:
          break;
      }
      doc.grid = grid;
      let text = JSON.stringify(doc);
      if (randInt(rng, 10) === 0) text = text.slice(0, randInt(rng, text.length)); // truncate
      const result = parseLevel(text);
      if (result.ok) accepted++;
      checkNeverThrowsAndAcceptedIsValid(text);
    }
    // Sanity check that the fuzzer exercises both sides.
    expect(accepted).toBeGreaterThan(0);
    expect(accepted).toBeLessThan(ITERATIONS);
  });
});
