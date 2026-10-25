import { describe, expect, it } from "vitest";
import { hashState } from "../../src/sim/hash";
import type { GameState } from "../../src/sim/state";
import { press, run, stateFrom } from "./helpers";

const rows = ["........", "...H....", "...H.-..", "P..H....", "########"];

describe("hashState", () => {
  it("equal states hash equally", () => {
    expect(hashState(stateFrom(rows))).toBe(hashState(stateFrom(rows)));
  });

  it("any single-field change changes the hash", () => {
    const base = stateFrom(rows);
    const variants: GameState[] = [
      { ...base, tick: base.tick + 1 },
      { ...base, rng: base.rng + 1 },
      { ...base, tiles: base.tiles.map((r, y) => (y === 0 ? "#" + r.slice(1) : r)) },
      { ...base, runner: { ...base.runner, x: base.runner.x + 1 } },
      { ...base, runner: { ...base.runner, y: base.runner.y + 1 } },
      { ...base, runner: { ...base.runner, facing: -1 } },
    ];
    for (const v of variants) expect(hashState(v)).not.toBe(hashState(base));
  });

  it("does not depend on object key order", () => {
    const base = stateFrom(rows);
    const reordered: GameState = {
      runner: { facing: base.runner.facing, y: base.runner.y, x: base.runner.x },
      tiles: base.tiles,
      height: base.height,
      width: base.width,
      rng: base.rng,
      tick: base.tick,
    };
    expect(hashState(reordered)).toBe(hashState(base));
  });

  it("matches the committed hash after 600 ticks of a fixed input pattern", () => {
    // Fixed level, seed and inputs: if this changes, gameplay changed. Update it only
    // together with an intentional rules change, and say so in the PR.
    let s = stateFrom(rows, 42);
    s = run(s, press.right, 48);
    s = run(s, press.up, 100);
    s = run(s, press.right, 152);
    s = run(s, press.none, 300);
    expect(s.tick).toBe(600);
    expect(hashState(s)).toBe(COMMITTED_HASH);
  });
});

const COMMITTED_HASH = 2978874540;
