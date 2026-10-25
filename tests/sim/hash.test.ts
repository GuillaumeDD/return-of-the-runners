import { describe, expect, it } from "vitest";
import { hashState } from "../../src/sim/hash";
import { newMonk, type GameState, type Monk } from "../../src/sim/state";
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
      { ...base, runner: { ...base.runner, busy: 1 } },
      { ...base, holes: [{ cx: 1, cy: 4, age: 0 }] },
      { ...base, goldLeft: base.goldLeft + 1 },
      { ...base, status: "dead" },
      { ...base, status: "won" },
    ];
    for (const v of variants) expect(hashState(v)).not.toBe(hashState(base));
  });

  it("distinguishes every monk field, and monk order", () => {
    const base = stateFrom(rows);
    const m = newMonk(1, 1);
    const a = { ...base, monks: [m] };
    const variants: Monk[] = [
      { ...m, x: m.x + 1 },
      { ...m, y: m.y + 1 },
      { ...m, facing: 1 },
      { ...m, busy: 1 },
      { ...m, mode: "trapped" },
      { ...m, mode: "escaping" },
      { ...m, mode: "dead" },
      { ...m, timer: 1 },
      { ...m, carry: 1 },
      { ...m, carry: -1 },
      { ...m, holeX: 2 },
      { ...m, holeY: 2 },
    ];
    for (const v of variants) expect(hashState({ ...base, monks: [v] })).not.toBe(hashState(a));
    const n = newMonk(2, 1);
    expect(hashState({ ...base, monks: [m, n] })).not.toBe(hashState({ ...base, monks: [n, m] }));
    expect(hashState({ ...base, monks: [] })).not.toBe(hashState(a));
  });

  it("distinguishes hole fields", () => {
    const base = stateFrom(rows);
    const a = { ...base, holes: [{ cx: 1, cy: 4, age: 0 }] };
    for (const h of [
      { cx: 2, cy: 4, age: 0 },
      { cx: 1, cy: 3, age: 0 },
      { cx: 1, cy: 4, age: 1 },
    ]) {
      expect(hashState({ ...base, holes: [h] })).not.toBe(hashState(a));
    }
  });

  it("does not depend on object key order", () => {
    const base = stateFrom(rows);
    const reordered: GameState = {
      status: base.status,
      runner: {
        busy: base.runner.busy,
        facing: base.runner.facing,
        y: base.runner.y,
        x: base.runner.x,
      },
      holes: base.holes,
      goldLeft: base.goldLeft,
      monks: base.monks,
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
    // Position first, so a movement regression is told apart from a serialization change.
    expect(s.runner).toEqual({ x: 56, y: 24, facing: 1, busy: 0 });
    expect(hashState(s)).toBe(COMMITTED_HASH);
  });
});

// A level with monks, a dig, gold and a ladder: covers the monk AI, PRNG (gold carry,
// respawn) and holes byte for byte.
const monkRows = ["H.....$....M", "H###H####H##", "H...H....H..", "H.P.H..$.H.M", "############"];

describe("hashState with monks", () => {
  it("matches the committed hash after 300 ticks with monks, digging and gold", () => {
    let s = stateFrom(monkRows, 7);
    const digR = { ...press.none, digRight: true };
    const digL = { ...press.none, digLeft: true };
    s = run(s, press.right, 30);
    s = run(s, digR, 1);
    s = run(s, press.left, 60);
    s = run(s, digL, 1);
    s = run(s, press.up, 120);
    s = run(s, press.right, 88);
    // By now one monk has carried gold and fallen into a hole; the other caught the runner.
    expect(s.tick).toBe(300);
    expect(s.status).toBe("dead");
    expect(s.monks.map((m) => m.mode)).toEqual(["free", "trapped"]);
    expect(hashState(s)).toBe(COMMITTED_MONK_HASH);
  });
});

const COMMITTED_MONK_HASH = 3733748255;
const COMMITTED_HASH = 3336778812;
