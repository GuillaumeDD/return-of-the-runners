import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { HOLE_LIFETIME, holePhase } from "../../src/sim/holes";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import { tileAt } from "../../src/sim/physics";
import { HOLE_TICKS, SUB } from "../../src/sim/rules";
import type { GameState } from "../../src/sim/state";
import { step } from "../../src/sim/step";
import { atCell, cell, placeRunner, press, run, stateFrom } from "./helpers";

const digLeft: PlayerInput = { ...NO_INPUT, digLeft: true };
const digRight: PlayerInput = { ...NO_INPUT, digRight: true };
const digBoth: PlayerInput = { ...NO_INPUT, digLeft: true, digRight: true };

// Runner stands on a brick floor at (3, 1).
const floor = ["........", "...P....", "########"];

function holes(s: GameState): { cx: number; cy: number }[] {
  return s.holes.map(({ cx, cy }) => ({ cx, cy }));
}

describe("digging", () => {
  it("digging right opens the brick diagonally below on the right", () => {
    const s = step(stateFrom(floor), digRight);
    expect(holes(s)).toEqual([{ cx: 4, cy: 2 }]);
    expect(s.runner.facing).toBe(1);
  });

  it("digging left opens the brick diagonally below on the left, and turns the runner", () => {
    const s = step(stateFrom(floor), digLeft);
    expect(holes(s)).toEqual([{ cx: 2, cy: 2 }]);
    expect(s.runner.facing).toBe(-1);
  });

  it("pressing both dig keys digs nothing", () => {
    expect(step(stateFrom(floor), digBoth).holes).toEqual([]);
  });

  it.each([
    ["bedrock", ["........", "...P....", "####@###"]],
    ["a ladder", ["........", "...P....", "####H###"]],
    ["an empty cell", ["........", "...P....", "####.###"]],
    ["outside the level", ["........", ".......P", "########"]],
  ])("cannot dig %s", (_name, rows) => {
    expect(step(stateFrom(rows), digRight).holes).toEqual([]);
  });

  it.each([
    ["a brick", "...P#..."],
    ["a ladder", "...PH..."],
    ["a bar", "...P-..."],
    ["gold", "...P$..."],
  ])("cannot dig under %s in the cell above the target", (_name, row) => {
    expect(step(stateFrom(["........", row, "########"]), digRight).holes).toEqual([]);
  });

  it("cannot dig while falling", () => {
    const s = stateFrom(["...P....", "........", "########"]);
    expect(step(s, digRight).holes).toEqual([]);
  });

  it("cannot dig while falling between two rows", () => {
    const s = placeRunner(stateFrom(["...P....", "........", "########"]), 3 * SUB, 4);
    expect(step(s, digRight).holes).toEqual([]);
  });

  // Regression: digging from a ladder or a bar used to be refused. The 1982 rules allow it
  // (the runner's own cell is not checked), see ARCHITECTURE.
  it("digs while standing on a ladder", () => {
    const s = atCell(stateFrom(["P..H....", "...H....", "########"]), 3, 1);
    expect(holes(step(s, digRight))).toEqual([{ cx: 4, cy: 2 }]);
    expect(holes(step(s, digLeft))).toEqual([{ cx: 2, cy: 2 }]);
  });

  it("digs while hanging on a bar", () => {
    const s = atCell(stateFrom(["P..-....", "########"]), 3, 0);
    expect(holes(step(s, digRight))).toEqual([{ cx: 4, cy: 1 }]);
  });

  // Regression: walking stops between two tiles, and digging used to need exact alignment,
  // so it only worked where climbing had aligned the runner (the top of a ladder).
  it("digs after walking and stopping between two tiles", () => {
    let s = run(stateFrom(["........", "P.......", "########"]), press.right, 21);
    expect(s.runner.x % SUB).not.toBe(0);
    s = step(s, digRight);
    expect(holes(s)).toEqual([{ cx: 2, cy: 2 }]);
    expect(s.runner.x).toBe(SUB);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7])(
    "from offset %i, digs from the nearest column and snaps onto it",
    (offset) => {
      const s = placeRunner(stateFrom(floor), 3 * SUB + offset, SUB);
      const near = offset < SUB / 2 ? 3 : 4;
      const right = step(s, digRight);
      expect(holes(right)).toEqual([{ cx: near + 1, cy: 2 }]);
      expect(right.runner.x).toBe(near * SUB);
      expect(holes(step(s, digLeft))).toEqual([{ cx: near - 1, cy: 2 }]);
    },
  );

  it("cannot dig when the nearest column has no floor under it", () => {
    const s = placeRunner(stateFrom(["P.......", "###....."]), 2 * SUB + 5, 0);
    expect(step(s, digLeft).holes).toEqual([]);
  });

  it.each([1, 2, 3, 4, 5, 6, 7])(
    "on a ladder %i sub-units below a row, digs from the nearest row and snaps onto it",
    (offset) => {
      const near = offset < SUB / 2 ? 1 : 2;
      // A ladder in column 3; bricks to its right only under the nearest row.
      const rows = ["P..H....", "...H....", "...H....", "...H....", "########"].map((r, y) =>
        y === near + 1 ? "...H####" : r,
      );
      const s = placeRunner(stateFrom(rows), 3 * SUB, SUB + offset);
      const dug = step(s, digRight);
      expect(holes(dug)).toEqual([{ cx: 4, cy: near + 1 }]);
      expect(dug.runner.y).toBe(near * SUB);
    },
  );

  it("digging freezes the runner for HOLE_TICKS.digging ticks", () => {
    let s = step(stateFrom(floor), digRight);
    expect(s.runner.busy).toBe(HOLE_TICKS.digging);
    const x = s.runner.x;
    s = run(s, press.left, HOLE_TICKS.digging);
    expect(s.runner.x).toBe(x);
    expect(s.runner.busy).toBe(0);
    s = run(s, press.left, 2);
    expect(s.runner.x).toBeLessThan(x);
  });

  it("cannot dig the same hole twice", () => {
    let s = step(stateFrom(floor), digRight);
    s = run(s, digRight, HOLE_TICKS.digging + 5);
    expect(s.holes).toHaveLength(1);
  });
});

describe("hole lifecycle", () => {
  // After the digging step, the hole is `steps` ticks old.
  function dugFor(steps: number): GameState {
    return run(step(stateFrom(floor), digRight), press.none, steps - 1);
  }

  it("stays solid while being dug, then opens", () => {
    const digging = dugFor(HOLE_TICKS.digging - 1);
    expect(holePhase(digging.holes[0]?.age ?? -1)).toBe("digging");
    expect(tileAt(digging, 4, 2)).toBe(TILE.brick);

    const open = dugFor(HOLE_TICKS.digging);
    expect(holePhase(open.holes[0]?.age ?? -1)).toBe("open");
    expect(tileAt(open, 4, 2)).toBe(TILE.empty);
  });

  it("closes after HOLE_TICKS.open ticks, still passable while closing", () => {
    const closing = dugFor(HOLE_TICKS.digging + HOLE_TICKS.open);
    expect(holePhase(closing.holes[0]?.age ?? -1)).toBe("closing");
    expect(tileAt(closing, 4, 2)).toBe(TILE.empty);
  });

  it("turns back into brick after HOLE_LIFETIME ticks", () => {
    const last = dugFor(HOLE_LIFETIME - 1);
    expect(last.holes).toHaveLength(1);
    const filled = dugFor(HOLE_LIFETIME);
    expect(filled.holes).toEqual([]);
    expect(tileAt(filled, 4, 2)).toBe(TILE.brick);
  });
});

describe("holes and the runner", () => {
  it("the runner falls into an open hole and stands in it", () => {
    const rows = ["...P....", "########", "########"];
    let s = step(stateFrom(rows), digRight);
    s = run(s, press.none, HOLE_TICKS.digging);
    s = run(s, press.right, 40);
    expect(cell(s)).toEqual({ x: 4, y: 1 });
    expect(s.status).toBe("playing");
  });

  it("the runner falls through an open hole to the floor below", () => {
    const rows = ["...P....", "########", "........", "########"];
    let s = step(stateFrom(rows), digRight);
    s = run(s, press.none, HOLE_TICKS.digging);
    s = run(s, press.right, 16);
    s = run(s, press.none, 40);
    expect(cell(s)).toEqual({ x: 4, y: 2 });
  });

  it("the runner walks out of a hole sideways into an open passage", () => {
    const rows = ["...P....", "#####...", "########"];
    let s = step(stateFrom(rows), digRight);
    s = run(s, press.none, HOLE_TICKS.digging);
    s = run(s, press.right, 100);
    expect(cell(s)).toEqual({ x: 7, y: 1 });
  });

  it("the runner dies when the hole refills around them", () => {
    const rows = ["...P....", "########", "########"];
    let s = step(stateFrom(rows), digRight);
    s = run(s, press.none, HOLE_TICKS.digging);
    s = run(s, press.right, 40);
    expect(cell(s)).toEqual({ x: 4, y: 1 });
    const age = s.holes[0]?.age ?? 0;
    s = run(s, press.none, HOLE_LIFETIME - age - 1);
    expect(s.status).toBe("playing");
    s = step(s, press.none);
    expect(s.status).toBe("dead");
  });

  it("a runner standing beside the hole survives the refill", () => {
    let s = step(stateFrom(floor), digRight);
    s = run(s, press.none, HOLE_LIFETIME);
    expect(s.holes).toEqual([]);
    expect(s.status).toBe("playing");
  });

  it("after death the state is frozen except for the tick", () => {
    const rows = ["...P....", "########", "########"];
    let s = step(stateFrom(rows), digRight);
    s = run(s, press.right, HOLE_LIFETIME + 10);
    expect(s.status).toBe("dead");
    const later = run(s, digLeft, 50);
    expect({ ...later, tick: s.tick }).toEqual(s);
    expect(later.tick).toBe(s.tick + 50);
  });
});
