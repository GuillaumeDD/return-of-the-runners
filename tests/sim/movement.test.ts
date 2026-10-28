import { describe, expect, it } from "vitest";
import { RUNNER_PERIOD, SUB } from "../../src/sim/rules";
import { isFalling } from "../../src/sim/move";
import { atCell, cell, p1, placeRunner, press, run, stateFrom } from "./helpers";

const TILE_TICKS = {
  walk: SUB * RUNNER_PERIOD.walk,
  climb: SUB * RUNNER_PERIOD.climb,
  fall: SUB * RUNNER_PERIOD.fall,
};

// Row 7 is the floor in most levels below.
const flat = [
  "........",
  "........",
  "........",
  "........",
  "........",
  "........",
  "..P.....",
  "########",
];

describe("walking", () => {
  it("walks right one tile in exactly SUB * walk-period ticks", () => {
    const s = run(stateFrom(flat), press.right, TILE_TICKS.walk);
    expect(cell(s)).toEqual({ x: 3, y: 6 });
    expect(p1(s).facing).toBe(1);
  });

  it("walks left and faces left", () => {
    const s = run(stateFrom(flat), press.left, TILE_TICKS.walk);
    expect(cell(s)).toEqual({ x: 1, y: 6 });
    expect(p1(s).facing).toBe(-1);
  });

  it("stops at a brick wall", () => {
    const s = run(stateFrom(["#P.#", "####"]), press.right, 100);
    expect(cell(s)).toEqual({ x: 2, y: 0 });
  });

  it("stops at the level edge", () => {
    const s = run(stateFrom(["P...", "####"]), press.left, 100);
    expect(cell(s)).toEqual({ x: 0, y: 0 });
  });

  it("stays put with no input or with opposite directions pressed", () => {
    const start = stateFrom(flat);
    expect(p1(run(start, press.none, 50))).toEqual(p1(start));
    expect(p1(run(start, press.leftRight, 50))).toEqual(p1(start));
  });

  it("can reverse mid-tile", () => {
    const mid = run(stateFrom(flat), press.right, 6); // 3 sub-units in
    const back = run(mid, press.left, 6);
    expect(p1(back).x).toBe(p1(stateFrom(flat)).x);
  });
});

describe("ladders", () => {
  // Ladder in column 3, rows 3 to 6; floor on row 7.
  const ladder = [
    "........",
    "........",
    "........",
    "...H....",
    "...H....",
    "...H....",
    "P..H....",
    "########",
  ];

  it("climbs up a ladder one tile in exactly SUB * climb-period ticks", () => {
    const s = run(atCell(stateFrom(ladder), 3, 6), press.up, TILE_TICKS.climb);
    expect(cell(s)).toEqual({ x: 3, y: 5 });
  });

  it("climbs down a ladder", () => {
    const s = run(atCell(stateFrom(ladder), 3, 3), press.down, TILE_TICKS.climb * 3);
    expect(cell(s)).toEqual({ x: 3, y: 6 });
  });

  it("cannot climb where there is no ladder (no jumping)", () => {
    const start = stateFrom(flat);
    expect(p1(run(start, press.up, 50))).toEqual(p1(start));
  });

  it("climbs off the top of a ladder and stands on it", () => {
    const s = run(atCell(stateFrom(ladder), 3, 6), press.up, 200);
    expect(cell(s)).toEqual({ x: 3, y: 2 });
    expect(isFalling(s, p1(s))).toBe(false);
  });

  it("walks onto a ladder and can then climb it", () => {
    const onLadder = run(stateFrom(ladder), press.right, TILE_TICKS.walk * 3);
    expect(cell(onLadder)).toEqual({ x: 3, y: 6 });
    expect(cell(run(onLadder, press.up, TILE_TICKS.climb))).toEqual({ x: 3, y: 5 });
  });

  it("snaps toward the ladder column before turning onto it", () => {
    // 3 sub-units left of the ladder column: pressing up first slides right to align.
    const start = placeRunner(stateFrom(ladder), 3 * SUB - 3, 6 * SUB);
    const aligned = run(start, press.up, 3 * RUNNER_PERIOD.walk);
    expect(p1(aligned)).toMatchObject({ x: 3 * SUB, y: 6 * SUB });
    const climbing = run(aligned, press.up, TILE_TICKS.climb);
    expect(cell(climbing)).toEqual({ x: 3, y: 5 });
  });

  it("steps off a ladder mid-climb by first snapping to the nearest row", () => {
    const start = placeRunner(stateFrom(ladder), 3 * SUB, 5 * SUB + 2);
    const s = run(start, press.left, 2 * RUNNER_PERIOD.climb);
    expect(p1(s).y).toBe(5 * SUB);
  });
});

describe("bars", () => {
  // Bar on row 2, columns 1 to 6; floor on row 7.
  const bars = [
    "........",
    "........",
    ".------.",
    "........",
    "........",
    "........",
    "P.......",
    "########",
  ];

  it("moves hand over hand along a bar without falling", () => {
    const start = atCell(stateFrom(bars), 1, 2);
    const s = run(start, press.right, SUB * RUNNER_PERIOD.bar * 3);
    expect(cell(s)).toEqual({ x: 4, y: 2 });
  });

  it("drops from a bar when pressing down, and lands on the floor", () => {
    const s = run(atCell(stateFrom(bars), 3, 2), press.down, 200);
    expect(cell(s)).toEqual({ x: 3, y: 6 });
  });

  // Regression: down did nothing when the runner hung mid-tile, i.e. after moving along
  // the bar and stopping between two columns.
  it("lets go of a bar when pressing down mid-tile, at any offset", () => {
    for (let off = 1; off < SUB; off++) {
      const start = placeRunner(stateFrom(bars), 3 * SUB + off, 2 * SUB);
      const s = run(start, press.down, 200);
      expect(cell(s), `offset ${String(off)}`).toEqual({ x: off < SUB / 2 ? 3 : 4, y: 6 });
    }
  });

  it("lets go of a bar after moving along it and stopping", () => {
    const moved = run(atCell(stateFrom(bars), 1, 2), press.right, RUNNER_PERIOD.bar * 5);
    expect(p1(moved).x % SUB).not.toBe(0);
    const s = run(moved, press.down, 200);
    expect(cell(s)).toEqual({ x: 2, y: 6 });
  });

  it("hanging past the end of a bar, still lets go", () => {
    // Moving left off column 1: the runner is between column 0 and the bar's first cell.
    const start = placeRunner(stateFrom(bars), SUB - 3, 2 * SUB);
    const s = run(start, press.down, 200);
    expect(cell(s)).toEqual({ x: 1, y: 6 });
  });

  it("grabs a bar when falling through its cell", () => {
    const s = run(atCell(stateFrom(bars), 3, 0), press.none, 200);
    expect(cell(s)).toEqual({ x: 3, y: 2 });
  });
});

describe("falling", () => {
  it("falls one tile in exactly SUB * fall-period ticks", () => {
    const s = run(atCell(stateFrom(flat), 2, 3), press.none, TILE_TICKS.fall);
    expect(cell(s)).toEqual({ x: 2, y: 4 });
  });

  it("lands on brick", () => {
    expect(cell(run(atCell(stateFrom(flat), 2, 0), press.none, 200))).toEqual({ x: 2, y: 6 });
  });

  it("lands on bedrock", () => {
    const rows = ["P...", "....", "....", "@@@@"];
    expect(cell(run(stateFrom(rows), press.none, 200))).toEqual({ x: 0, y: 2 });
  });

  it("lands on the top of a ladder", () => {
    const rows = ["P...", "....", "H...", "H...", "####"];
    expect(cell(run(stateFrom(rows), press.none, 200))).toEqual({ x: 0, y: 1 });
  });

  it("lands on the bottom row of the level", () => {
    const rows = ["P...", "....", "....", "...."];
    expect(cell(run(stateFrom(rows), press.none, 200))).toEqual({ x: 0, y: 3 });
  });

  it("walking off a ledge makes the runner fall", () => {
    const rows = ["P...", "#...", "....", "####"];
    const s = run(stateFrom(rows), press.right, 200);
    expect(p1(s).y).toBe(2 * SUB);
  });

  it("ignores input while falling", () => {
    const start = atCell(stateFrom(flat), 2, 0);
    const a = run(start, press.left, TILE_TICKS.fall * 2);
    const b = run(start, press.none, TILE_TICKS.fall * 2);
    expect(p1(a).x).toBe(p1(b).x);
    expect(p1(a).y).toBe(p1(b).y);
  });
});

describe("step", () => {
  it("does not mutate its input state", () => {
    const start = stateFrom(flat);
    const snapshot = structuredClone(start);
    run(start, press.right, 10);
    expect(start).toEqual(snapshot);
  });

  it("advances the tick counter by one", () => {
    expect(run(stateFrom(flat), press.none, 7).tick).toBe(7);
  });
});
