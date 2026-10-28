import { describe, expect, it } from "vitest";
import { TILE_CHARS } from "../../src/level/format";
import { parseLevel } from "../../src/level/parse";
import { makeRng, randInt } from "../helpers/rng";
import { loadFixtures } from "./fixtures";
import { expectLevelInvariants } from "./invariants";

const ITERATIONS = 2000;
const valid = loadFixtures("valid").map((f) => JSON.parse(f.text) as Record<string, unknown>);
const tileChars = [...TILE_CHARS, "X", " ", "é", "\u0000"];

/** Mostly a cell inside a small grid; now and then a value that is not one. */
function randomCoord(rng: () => number): unknown {
  const odd = [-1, 64, 1.5, "1", null, 1e9];
  return randInt(rng, 8) === 0 ? odd[randInt(rng, odd.length)] : randInt(rng, 10);
}

function checkNeverThrowsAndAcceptedIsValid(text: string): void {
  let result: ReturnType<typeof parseLevel> | undefined;
  expect(() => (result = parseLevel(text)), text.slice(0, 200)).not.toThrow();
  if (result?.ok) expectLevelInvariants(result.level);
}

describe("parseLevel fuzzing", () => {
  it("random strings: never throws", () => {
    const rng = makeRng(1);
    const alphabet = '{}[]",:0123456789.-truefalsnl #@H$EPMQTt%~\\ué \n';
    for (let i = 0; i < ITERATIONS; i++) {
      const len = randInt(rng, 200);
      let s = "";
      for (let j = 0; j < len; j++) s += alphabet[randInt(rng, alphabet.length)] ?? "";
      checkNeverThrowsAndAcceptedIsValid(s);
    }
  });

  it("mutated valid v1 and v2 levels: never throws, and anything accepted satisfies all invariants", () => {
    const rng = makeRng(2);
    let accepted = 0;
    let acceptedWithLinks = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      const doc = structuredClone(valid[randInt(rng, valid.length)]) as Record<string, unknown>;
      const grid = [...(doc.grid as string[])];
      switch (randInt(rng, 10)) {
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
        case 6:
          // a random link, often onto real cells and sometimes onto teleporter tiles
          doc.teleports = [
            ...(Array.isArray(doc.teleports) ? (doc.teleports as unknown[]) : []),
            Array.from({ length: 3 + randInt(rng, 3) }, () => randomCoord(rng)),
          ];
          break;
        case 7:
          doc.teleports = [{}, "1,2,3,4", null, [], [[1, 2, 3, 4]]][randInt(rng, 5)];
          break;
        case 8:
          doc.version = [1, 2, 3, "2"][randInt(rng, 4)];
          break;
        default:
          break;
      }
      doc.grid = grid;
      let text = JSON.stringify(doc);
      if (randInt(rng, 10) === 0) text = text.slice(0, randInt(rng, text.length)); // truncate
      const result = parseLevel(text);
      if (result.ok) accepted++;
      if (result.ok && result.level.teleports.length > 0) acceptedWithLinks++;
      checkNeverThrowsAndAcceptedIsValid(text);
    }
    // Sanity check that the fuzzer exercises both sides.
    expect(accepted).toBeGreaterThan(0);
    expect(accepted).toBeLessThan(ITERATIONS);
    expect(acceptedWithLinks).toBeGreaterThan(0);
  });
});
