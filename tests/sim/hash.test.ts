import { describe, expect, it } from "vitest";
import { hashState } from "../../src/sim/hash";
import { newMonk, type GameState, type Monk, type Player } from "../../src/sim/state";
import { p1, press, run, stateFrom, withPlayer } from "./helpers";

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
      { ...base, holes: [{ cx: 1, cy: 4, age: 0 }] },
      { ...base, goldLeft: base.goldLeft + 1 },
      { ...base, teleports: [[0, 0, 1, 0]] },
      { ...base, teleports: [[0, 0, 2, 0]] },
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
      { ...m, warp: 1 },
      { ...m, mode: "trapped" },
      { ...m, mode: "escaping" },
      { ...m, mode: "dead" },
      { ...m, mode: "snared" },
      { ...m, mode: "dazed" },
      { ...m, timer: 1 },
      { ...m, carry: 1 },
      { ...m, carry: -1 },
      { ...m, holeX: 2 },
      { ...m, holeY: 2 },
      { ...m, roamX: 2 },
      { ...m, roamY: 2 },
      { ...m, roamLeft: 2 },
    ];
    for (const v of variants) expect(hashState({ ...base, monks: [v] })).not.toBe(hashState(a));
    const n = newMonk(2, 1);
    expect(hashState({ ...base, monks: [m, n] })).not.toBe(hashState({ ...base, monks: [n, m] }));
    expect(hashState({ ...base, monks: [] })).not.toBe(hashState(a));
  });

  it("distinguishes every player field, and player order", () => {
    const base = stateFrom(["P......Q", "########"], 1, 2);
    const p = p1(base);
    const variants: Partial<Player>[] = [
      { x: p.x + 1 },
      { y: p.y + 1 },
      { facing: -1 },
      { busy: 1 },
      { warp: 1 },
      { mode: "dead" },
      { mode: "out" },
      { timer: 1 },
      { lives: p.lives - 1 },
      { gold: 1 },
      { startX: p.startX + 1 },
      { startY: p.startY + 1 },
      { item: "a" },
      { item: "b" },
      { pickHeld: true },
      { useHeld: true },
      { drill: true },
      { bombs: "o" },
      { bombs: "O" },
      { bombs: "oO" },
      { bombs: "Oo" },
      { bombHeld: true },
      { hidden: true },
    ];
    for (const v of variants) expect(hashState(withPlayer(base, v))).not.toBe(hashState(base));
    const swapped = { ...base, players: [...base.players].reverse() };
    expect(hashState(swapped)).not.toBe(hashState(base));
    expect(hashState({ ...base, players: [p] })).not.toBe(hashState(base));
  });

  it("distinguishes rubble fields, and rubble order", () => {
    const base = stateFrom(rows);
    const r = { cx: 1, y: 8, landed: -1 };
    const a = { ...base, rubble: [r] };
    for (const v of [
      { ...r, cx: 2 },
      { ...r, y: 9 },
      { ...r, landed: 0 },
    ]) {
      expect(hashState({ ...base, rubble: [v] })).not.toBe(hashState(a));
    }
    const o = { cx: 5, y: 0, landed: 3 };
    expect(hashState({ ...base, rubble: [r, o] })).not.toBe(hashState({ ...base, rubble: [o, r] }));
    expect(hashState(base)).not.toBe(hashState(a));
  });

  it("distinguishes crater, fuse and blast fields", () => {
    const base = stateFrom(rows);
    const c = { cx: 1, cy: 4, left: 5 };
    const f = { cx: 1, cy: 3, big: false, left: 5 };
    const b = { cx: 1, cy: 3, big: false, age: 2 };
    const a = { ...base, craters: [c], fuses: [f], blasts: [b] };
    const variants: GameState[] = [
      { ...a, craters: [{ ...c, cx: 2 }] },
      { ...a, craters: [{ ...c, cy: 3 }] },
      { ...a, craters: [{ ...c, left: 6 }] },
      { ...a, craters: [] },
      { ...a, fuses: [{ ...f, cx: 2 }] },
      { ...a, fuses: [{ ...f, cy: 2 }] },
      { ...a, fuses: [{ ...f, big: true }] },
      { ...a, fuses: [{ ...f, left: 6 }] },
      { ...a, fuses: [] },
      { ...a, blasts: [{ ...b, cx: 2 }] },
      { ...a, blasts: [{ ...b, cy: 2 }] },
      { ...a, blasts: [{ ...b, big: true }] },
      { ...a, blasts: [{ ...b, age: 3 }] },
      { ...a, blasts: [] },
    ];
    for (const v of variants) expect(hashState(v)).not.toBe(hashState(a));
  });

  it("distinguishes snare and cloud fields", () => {
    const base = stateFrom(rows);
    const n = { cx: 1, cy: 3 };
    const c = { cx: 2, cy: 3, width: 3, left: 5 };
    const a = { ...base, snares: [n], clouds: [c] };
    const variants: GameState[] = [
      { ...a, snares: [{ ...n, cx: 2 }] },
      { ...a, snares: [{ ...n, cy: 2 }] },
      { ...a, snares: [] },
      { ...a, clouds: [{ ...c, cx: 1 }] },
      { ...a, clouds: [{ ...c, cy: 2 }] },
      { ...a, clouds: [{ ...c, width: 2 }] },
      { ...a, clouds: [{ ...c, left: 6 }] },
      { ...a, clouds: [] },
    ];
    for (const v of variants) expect(hashState(v)).not.toBe(hashState(a));
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
      players: [
        {
          hidden: p1(base).hidden,
          bombHeld: p1(base).bombHeld,
          bombs: p1(base).bombs,
          drill: p1(base).drill,
          useHeld: p1(base).useHeld,
          pickHeld: p1(base).pickHeld,
          item: p1(base).item,
          startY: p1(base).startY,
          startX: p1(base).startX,
          gold: p1(base).gold,
          lives: p1(base).lives,
          timer: p1(base).timer,
          mode: p1(base).mode,
          warp: p1(base).warp,
          busy: p1(base).busy,
          facing: p1(base).facing,
          y: p1(base).y,
          x: p1(base).x,
        },
      ],
      clouds: base.clouds,
      snares: base.snares,
      blasts: base.blasts,
      fuses: base.fuses,
      craters: base.craters,
      rubble: base.rubble,
      holes: base.holes,
      goldLeft: base.goldLeft,
      teleports: base.teleports,
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
    expect(p1(s)).toMatchObject({ x: 56, y: 24, facing: 1, busy: 0 });
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

const COMMITTED_MONK_HASH = 1303579131;
const COMMITTED_HASH = 2948648256;
