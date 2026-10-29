import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import { monkAt } from "../../src/sim/physics";
import {
  DAZE_TICKS,
  FUSE_TICKS,
  GAS_CELLS,
  GAS_FIRE_TICKS,
  GAS_TICKS,
  SUB,
} from "../../src/sim/rules";
import { createState, newMonk, type GameState, type Monk } from "../../src/sim/state";
import { cell, levelFrom, p1, press, run, stateFrom, stepOne, withPlayer } from "./helpers";

const use: PlayerInput = { ...NO_INPUT, use: true };
const pick: PlayerInput = { ...NO_INPUT, pickUp: true };
const bomb: PlayerInput = { ...NO_INPUT, bomb: true };

/** A press of a key: one tick held, one released. */
function tap(s: GameState, input: PlayerInput): GameState {
  return stepOne(stepOne(s, input), NO_INPUT);
}

function monk(s: GameState, i = 0): Monk {
  const m = s.monks[i];
  if (m === undefined) throw new Error(`no monk ${String(i)}`);
  return m;
}

const holding = (s: GameState, item: string): GameState => withPlayer(s, { item });

describe("snares", () => {
  it("are picked up into the item slot, and swapped like any item", () => {
    let s = stateFrom(["Psg.", "@@@@"]);
    s = run(s, press.right, 2 * 8);
    s = tap(s, pick);
    expect([p1(s).item, s.tiles[0]]).toEqual([TILE.snare, "..g."]);
    s = run(s, press.right, 2 * 8);
    s = tap(s, pick);
    expect([p1(s).item, s.tiles[0]]).toEqual([TILE.gasSpray, "..s."]);
  });

  it("the use key lays the snare in the player's cell, which empties the slot", () => {
    let s = holding(stateFrom(["..P.", "@@@@"]), TILE.snare);
    s = tap(s, use);
    expect(s.snares).toEqual([{ cx: 2, cy: 0 }]);
    expect(p1(s).item).toBe("");
    // The cell itself is unchanged: the armed snare lives in `snares`.
    expect(s.tiles[0]).toBe("....");
  });

  it("is not laid while falling, nor where one is already armed", () => {
    const falling = withPlayer(holding(stateFrom(["P...", "....", "@@@@"]), TILE.snare), {
      y: 2,
    });
    const t = stepOne(falling, use);
    expect([t.snares, p1(t).item]).toEqual([[], TILE.snare]);
    let s = holding(stateFrom(["..P.", "@@@@"]), TILE.snare);
    s = { ...s, snares: [{ cx: 2, cy: 0 }] };
    s = tap(s, use);
    expect([s.snares.length, p1(s).item]).toEqual([1, TILE.snare]);
  });

  it("is laid only in an empty cell: not on a ladder, a bar or gold", () => {
    for (const row of ["..PH", "..P-", "..P$"]) {
      // The player stands on the ladder, hangs from the bar, or is on the gold's cell.
      let s = holding(stateFrom([row, "@@@@"]), TILE.snare);
      s = withPlayer(s, { x: 3 * SUB });
      s = tap(s, use);
      expect([s.snares, p1(s).item], row).toEqual([[], TILE.snare]);
    }
  });

  // Regression (self-review): a monk snared with gold kept it for good, and the level
  // could never be won.
  it("a monk snared with gold drops it in the snare's cell, or the cell above", () => {
    let s = stateFrom(["P.......", "@@@@@@@@"]);
    s = {
      ...s,
      goldLeft: 1,
      snares: [{ cx: 4, cy: 0 }],
      monks: [{ ...newMonk(5, 0), carry: 20 }],
    };
    for (let t = 0; t < 100 && monk(s).mode === "free"; t++) s = stepOne(s, NO_INPUT);
    expect([monk(s).mode, monk(s).carry, s.tiles[0]]).toEqual(["snared", 0, "....$..."]);
    // The runner walks past the hanging monk and takes the gold.
    s = run(s, press.right, 2 * 8 * 4);
    expect(s.goldLeft).toBe(0);
    let t = stateFrom([".......", "P...$..", "@@@@@@@"]);
    t = {
      ...t,
      goldLeft: 2,
      snares: [{ cx: 4, cy: 1 }],
      monks: [{ ...newMonk(5, 1), carry: 20 }],
    };
    for (let i = 0; i < 100 && monk(t).mode === "free"; i++) t = stepOne(t, NO_INPUT);
    expect([monk(t).mode, t.tiles[0], t.tiles[1]]).toEqual(["snared", "....$..", "....$.."]);
  });

  // Regression (self-review): a snared monk on a start or a teleporter exit blocked it.
  it("a snared monk blocks neither a player's start nor a teleporter's exit", () => {
    let s = stateFrom(["P......Q", "@@@@@@@@"], 1, 2);
    s = withPlayer(s, { mode: "dead", timer: 1 });
    s = { ...s, monks: [{ ...newMonk(0, 0), mode: "snared" }] };
    s = stepOne(s, NO_INPUT);
    expect(p1(s).mode).toBe("alive");
    const level = levelFrom(["PT....t.", "@@@@@@@@"]);
    let t = createState({ ...level, teleports: [[1, 0, 6, 0]] }, 1, 1);
    t = { ...t, monks: [{ ...newMonk(6, 0), mode: "snared" }] };
    t = run(t, press.right, 2 * 8);
    expect(p1(t)).toMatchObject({ x: 6 * SUB, y: 0 });
    expect(p1(t).warp).toBeGreaterThan(0);
  });

  it("holds the first monk that walks in, aligned on its cell, for good", () => {
    let s = holding(stateFrom(["P.........M", "@@@@@@@@@@@"]), TILE.snare);
    s = run(s, press.right, 2 * 8 * 5);
    s = tap(s, use);
    s = run(s, press.left, 2 * 8 * 5);
    expect(cell(s)).toEqual({ x: 0, y: 0 });
    for (let t = 0; t < 600 && monk(s).mode === "free"; t++) s = stepOne(s, NO_INPUT);
    expect(monk(s)).toMatchObject({ mode: "snared", x: 5 * SUB, y: 0 });
    expect(s.snares).toEqual([]);
    s = run(s, press.none, 3000);
    expect(monk(s)).toMatchObject({ mode: "snared", x: 5 * SUB, y: 0 });
    expect(s.status).toBe("playing");
  });

  it("other monks walk past a snared one, and catch the runner", () => {
    let s = stateFrom(["P.......", "@@@@@@@@"]);
    s = {
      ...s,
      monks: [{ ...newMonk(5, 0), mode: "snared" }, newMonk(7, 0)],
    };
    for (let t = 0; t < 600 && s.status === "playing"; t++) s = stepOne(s, NO_INPUT);
    expect(s.status).toBe("dead");
    expect(monk(s, 0).mode).toBe("snared");
    expect(monk(s, 1).x).toBeLessThan(5 * SUB);
  });

  it("a snared monk is no body: it catches nobody, and the runner passes it", () => {
    let s = stateFrom(["....P", "@@@@@"]);
    s = { ...s, monks: [{ ...newMonk(2, 0), mode: "snared" }] };
    expect(monkAt(s, 2, 0)).toBe(false);
    s = run(s, press.left, 2 * 8 * 4);
    expect([cell(s), s.status]).toEqual([{ x: 0, y: 0 }, "playing"]);
  });

  it("the runner walks over an armed snare unharmed (provisional)", () => {
    let s: GameState = { ...stateFrom(["P....", "@@@@@"]), snares: [{ cx: 2, cy: 0 }] };
    s = run(s, press.right, 2 * 8 * 4);
    expect([cell(s), p1(s).mode, s.snares.length]).toEqual([{ x: 4, y: 0 }, "alive", 1]);
  });

  it("only death frees a snared monk: a bomb blast kills it, and it reappears free", () => {
    let s = stateFrom([".......R", "P.......", "@@@@@@@@"]);
    s = withPlayer(s, { bombs: "o" });
    s = { ...s, monks: [{ ...newMonk(2, 1), mode: "snared" }] };
    s = run(s, press.right, 2 * 8 * 3);
    s = tap(s, bomb);
    s = run(s, press.right, 2 * 8 * 4);
    s = run(s, press.none, FUSE_TICKS);
    expect(monk(s).mode).not.toBe("snared");
    s = run(s, press.none, 200);
    expect(monk(s).mode).toBe("free");
  });
});

describe("the gas gun", () => {
  it(`fires a cloud over the ${String(GAS_CELLS)} cells in front, on the player's row, for GAS_TICKS`, () => {
    let s = holding(stateFrom(["P.......", "@@@@@@@@"]), TILE.gasSpray);
    s = stepOne(s, use);
    expect(s.clouds).toEqual([{ cx: 1, cy: 0, width: GAS_CELLS, left: GAS_TICKS - 1 }]);
    s = run(s, press.none, GAS_TICKS - 2);
    expect(s.clouds.length).toBe(1);
    s = stepOne(s, NO_INPUT);
    expect(s.clouds).toEqual([]);
  });

  it("fires the way the player faces", () => {
    let s = holding(stateFrom(["......P", "@@@@@@@"]), TILE.gasSpray);
    s = withPlayer(s, { facing: -1 });
    s = stepOne(s, use);
    expect(s.clouds.map((c) => [c.cx, c.width])).toEqual([[6 - GAS_CELLS, GAS_CELLS]]);
  });

  it("stops at a wall; nothing comes out against one", () => {
    let s = holding(stateFrom(["P.#.....", "@@@@@@@@"]), TILE.gasSpray);
    s = stepOne(s, use);
    expect(s.clouds.map((c) => [c.cx, c.width])).toEqual([[1, 1]]);
    let t = holding(stateFrom(["P#......", "@@@@@@@@"]), TILE.gasSpray);
    t = stepOne(t, use);
    expect([t.clouds, p1(t).busy]).toEqual([[], 0]);
  });

  it("is kept: it fires again once the player is free, and two clouds can be out", () => {
    let s = holding(stateFrom(["P.......", "@@@@@@@@"]), TILE.gasSpray);
    s = tap(s, use);
    expect([p1(s).item, p1(s).busy]).toEqual([TILE.gasSpray, GAS_FIRE_TICKS - 1]);
    s = run(s, press.none, GAS_FIRE_TICKS);
    s = withPlayer(s, { facing: 1 });
    s = run(s, press.right, 2 * 8 * 4);
    s = tap(s, use);
    expect(s.clouds.map((c) => c.cx)).toEqual([1, 5]);
  });

  it("a monk walking into a cloud stops, dazed, and catches nobody passing through", () => {
    let s = holding(stateFrom(["P..........M", "@@@@@@@@@@@@"]), TILE.gasSpray);
    s = run(s, press.right, 2 * 8 * 4);
    s = tap(s, use);
    for (let t = 0; t < 400 && monk(s).mode === "free"; t++) s = stepOne(s, NO_INPUT);
    expect(monk(s).mode).toBe("dazed");
    const at = monk(s).x;
    expect(Math.floor((at + SUB / 2) / SUB)).toBeGreaterThanOrEqual(5);
    s = run(s, press.none, 30);
    expect(monk(s).x).toBe(at);
    // The runner walks through the cloud and the dazed monk, unharmed.
    s = run(s, press.right, 2 * 8 * 6);
    expect([s.status, cell(s).x]).toEqual(["playing", 10]);
  });

  it("once the cloud is gone, the monk stays dazed DAZE_TICKS, then chases again", () => {
    let s = stateFrom(["P......", "@@@@@@@"]);
    s = {
      ...s,
      monks: [newMonk(4, 0)],
      clouds: [{ cx: 3, cy: 0, width: 3, left: 10 }],
    };
    s = stepOne(s, NO_INPUT);
    expect(monk(s)).toMatchObject({ mode: "dazed", timer: DAZE_TICKS });
    s = run(s, press.none, 9);
    expect(s.clouds).toEqual([]);
    expect(monk(s).timer).toBe(DAZE_TICKS);
    s = run(s, press.none, DAZE_TICKS - 1);
    expect(monk(s)).toMatchObject({ mode: "dazed", x: 4 * SUB });
    s = stepOne(s, NO_INPUT);
    expect(monk(s)).toMatchObject({ mode: "free", x: 4 * SUB });
    s = run(s, press.none, 3 * 4);
    expect(monk(s).x).toBeLessThan(4 * SUB);
  });

  it("a monk on a ladder or a bar is not affected", () => {
    let s = stateFrom(["P...H.", "....H.", "@@@@@@"]);
    s = { ...s, monks: [newMonk(4, 0)], clouds: [{ cx: 3, cy: 0, width: 3, left: 50 }] };
    s = stepOne(s, NO_INPUT);
    expect(monk(s).mode).toBe("free");
    let t = stateFrom(["....--", "P.....", "@@@@@@"]);
    t = { ...t, monks: [newMonk(4, 0)], clouds: [{ cx: 3, cy: 0, width: 3, left: 50 }] };
    t = stepOne(t, NO_INPUT);
    expect(monk(t).mode).toBe("free");
  });

  // Regression (self-review): a dazed monk falling into a hole was not trapped.
  it("a dazed monk that falls into a dug hole is trapped in it", () => {
    let s = stateFrom(["P.....", "@@@@#@", "@@@@@@"]);
    s = {
      ...s,
      holes: [{ cx: 4, cy: 1, age: 20 }],
      monks: [{ ...newMonk(4, 0), mode: "dazed", timer: DAZE_TICKS }],
    };
    s = run(s, press.none, 2 * SUB);
    expect(monk(s)).toMatchObject({ mode: "trapped", holeX: 4, holeY: 1 });
  });

  it("a dazed monk with nothing under it still falls", () => {
    let s = stateFrom(["P.....", "......", "@@@@@@"]);
    s = { ...s, monks: [{ ...newMonk(4, 0), mode: "dazed", timer: DAZE_TICKS }] };
    s = run(s, press.none, 2 * SUB);
    expect(monk(s)).toMatchObject({ mode: "dazed", y: SUB });
  });
});
