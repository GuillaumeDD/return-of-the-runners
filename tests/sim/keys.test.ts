import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { NO_INPUT } from "../../src/sim/input";
import { SUB } from "../../src/sim/rules";
import { newMonk, type GameState } from "../../src/sim/state";
import { playersAtExit } from "../../src/sim/step";
import { atCell, cell, p1, press, run, stateFrom, stepOne, withPlayer } from "./helpers";

const at = (s: GameState, cx: number, cy: number): string => s.tiles[cy]?.charAt(cx) ?? "";
const holding = (s: GameState, item: string): GameState => withPlayer(s, { item });

describe("doors", () => {
  it("a closed door is a wall: the runner stops next to it", () => {
    const s = stateFrom(["P..A..", "@@@@@@"]);
    expect(cell(run(s, press.right, 100))).toEqual({ x: 2, y: 0 });
  });

  it("a closed door is floor: the runner stands on it", () => {
    const s = stateFrom(["P...", "B...", "@@@@"]);
    expect(cell(run(s, press.none, 30))).toEqual({ x: 0, y: 0 });
  });

  it("cannot be dug", () => {
    const s = stateFrom(["P...", ".C..", "@@@@"]);
    expect(stepOne(s, { ...NO_INPUT, digRight: true }).holes).toEqual([]);
  });

  it("a key opens only its colour: the wrong key leaves the door closed", () => {
    for (const key of [TILE.keyGreen, TILE.keyBlue]) {
      const s = holding(stateFrom(["P..A..", "@@@@@@"]), key);
      const t = run(s, press.right, 100);
      expect(at(t, 3, 0), key).toBe(TILE.doorRed);
      expect(p1(t).item).toBe(key);
    }
  });

  it("carried to its door, the key opens it for good and is used up", () => {
    const s = holding(stateFrom(["P..A..", "@@@@@@"]), TILE.keyRed);
    const t = run(s, press.right, 100);
    expect(at(t, 3, 0)).toBe(TILE.empty);
    expect(p1(t).item).toBe("");
    // The runner walks on through.
    expect(cell(t).x).toBeGreaterThan(3);
  });

  it("only when carried: a key lying next to the door does nothing", () => {
    const s = stateFrom(["P.aA..", "@@@@@@"]);
    const t = run(s, press.right, 100);
    expect(at(t, 3, 0)).toBe(TILE.doorRed);
    expect(at(t, 2, 0)).toBe(TILE.keyRed);
  });

  it("opens one door per key: the other doors of its colour stay closed", () => {
    // Two red doors in a row: one key opens the first only.
    const s = holding(stateFrom(["P..AA.", "@@@@@@"]), TILE.keyRed);
    const t = run(s, press.right, 100);
    expect([at(t, 3, 0), at(t, 4, 0)]).toEqual([TILE.empty, TILE.doorRed]);
    expect(cell(t)).toEqual({ x: 3, y: 0 });
  });

  it("opens from above, below or the side, but not diagonally", () => {
    // Standing on the door (it is below the runner's centre cell).
    const above = holding(stateFrom(["P..", "A..", "@@@"]), TILE.keyRed);
    expect(at(stepOne(above, NO_INPUT), 0, 1)).toBe(TILE.empty);
    // Diagonal: the door is below and to the right.
    const diagonal = holding(stateFrom(["P..", "@A.", "@@@"]), TILE.keyRed);
    expect(at(stepOne(diagonal, NO_INPUT), 1, 1)).toBe(TILE.doorRed);
    // Below, climbing a ladder up to it.
    const below = holding(atCell(stateFrom(["..C.", "..H.", "P.H.", "@@@@"]), 2, 2), TILE.keyBlue);
    const t = run(below, press.up, 20);
    expect(at(t, 2, 0)).toBe(TILE.empty);
  });

  it("an opened door gives no support: a runner standing on it falls", () => {
    const s = holding(stateFrom(["P..", "A..", "...", "@@@"]), TILE.keyRed);
    const t = run(s, press.none, 3 * SUB);
    expect(cell(t)).toEqual({ x: 0, y: 2 });
  });

  it("monks do not open doors, and walk into them as into a wall", () => {
    let s = stateFrom(["P.A..M", "@@@@@@"]);
    s = { ...s, monks: [newMonk(5, 0)] };
    s = run(s, press.none, 300);
    expect(at(s, 2, 0)).toBe(TILE.doorRed);
    expect(s.status).toBe("playing");
    expect(s.monks[0]?.x).toBe(3 * SUB);
  });
});

describe("the exit", () => {
  it("is not there while gold is left, and appears on the tick the last gold is taken", () => {
    // Exit at (5, 0); the last gold at (3, 0).
    let s = stateFrom(["P..$.E", "@@@@@@"]);
    while (s.goldLeft > 0) {
      expect(playersAtExit(s)).toEqual([]);
      s = stepOne(s, press.right);
    }
    // Taken as the runner's centre enters the gold's cell.
    expect(Math.floor((p1(s).x + SUB / 2) / SUB)).toBe(3);
    // The level is won by reaching it now.
    s = run(s, press.right, 40);
    expect(s.status).toBe("won");
  });

  // Regression (self-review): the exit, not there yet, still blocked digging under it.
  it("the brick under the exit can be dug, before and after it appears", () => {
    const s = stateFrom(["PE$", "###", "@@@"]);
    const dig = { ...NO_INPUT, digRight: true };
    expect(stepOne(s, dig).holes.map((h) => [h.cx, h.cy])).toEqual([[1, 1]]);
    expect(stepOne({ ...s, goldLeft: 0 }, dig).holes.map((h) => [h.cx, h.cy])).toEqual([[1, 1]]);
  });

  it("an exit walled in by a door needs that door's key", () => {
    const rows = ["P$.BE", "@@@@@"];
    const locked = run(stateFrom(rows), press.right, 100);
    expect(locked.status).toBe("playing");
    expect(cell(locked)).toEqual({ x: 2, y: 0 });
    const keyed = run(holding(stateFrom(rows), TILE.keyGreen), press.right, 100);
    expect(keyed.status).toBe("won");
  });
});
