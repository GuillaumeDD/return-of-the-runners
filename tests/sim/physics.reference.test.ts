import { describe, expect, it } from "vitest";
import { isPassable, isSupported, tileAt } from "../../src/sim/physics";
import { makeRng, randInt } from "../helpers/rng";
import { stateFrom } from "./helpers";

// Naive references, written straight from the rules table in docs/plans/step-1.md,
// with no shared code: a lookup table and explicit bounds checks.
const SOLID = new Set(["#", "@"]);

function refTile(rows: string[], x: number, y: number): string {
  const row = rows[y];
  if (row === undefined || x < 0 || x >= row.length || y < 0) return "@";
  return row[x] ?? "@";
}

function refPassable(rows: string[], x: number, y: number): boolean {
  return !SOLID.has(refTile(rows, x, y));
}

function refSupported(rows: string[], x: number, y: number): boolean {
  const here = refTile(rows, x, y);
  if (here === "H" || here === "-") return true;
  if (y === rows.length - 1) return true;
  const below = refTile(rows, x, y + 1);
  return below === "#" || below === "@" || below === "H";
}

const ALPHABET = [".", ".", ".", "#", "@", "H", "-", "$", "E"];

describe("physics vs naive reference (randomized)", () => {
  it("tileAt, isPassable and isSupported agree on 5,000 random grids", () => {
    const rng = makeRng(3);
    for (let i = 0; i < 5000; i++) {
      const w = 1 + randInt(rng, 6);
      const h = 1 + randInt(rng, 6);
      const rows = Array.from({ length: h }, () =>
        Array.from({ length: w }, () => ALPHABET[randInt(rng, ALPHABET.length)] ?? ".").join(""),
      );
      // Runner marker so createState accepts the grid; it reads as empty terrain.
      const withRunner = rows.map((r, y) => (y === 0 ? "P" + r.slice(1) : r));
      const s = stateFrom(withRunner);
      const terrain = withRunner.map((r, y) => (y === 0 ? "." + r.slice(1) : r));
      for (let y = -1; y <= h; y++) {
        for (let x = -1; x <= w; x++) {
          const where = `grid ${JSON.stringify(terrain)} at (${String(x)}, ${String(y)})`;
          expect(tileAt(s, x, y), where).toBe(refTile(terrain, x, y));
          expect(isPassable(s, x, y), where).toBe(refPassable(terrain, x, y));
          if (x >= 0 && x < w && y >= 0 && y < h) {
            expect(isSupported(s, x, y), where).toBe(refSupported(terrain, x, y));
          }
        }
      }
    }
  });
});
