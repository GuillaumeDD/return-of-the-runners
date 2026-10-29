import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { centerCell, countGold, takeGold } from "../../src/sim/gold";
import { HOLE_LIFETIME } from "../../src/sim/holes";
import { SUB } from "../../src/sim/rules";
import {
  atCell,
  cell,
  p1,
  placeRunner,
  press,
  run,
  stateFrom,
  stepOne,
  withPlayer,
} from "./helpers";

describe("gold", () => {
  it("counts the level's gold at the start", () => {
    expect(stateFrom(["P.$.$..E", "########"]).goldLeft).toBe(2);
    expect(countGold(["$$.", ".$."])).toBe(3);
  });

  it("walking onto gold collects it and decrements the counter", () => {
    let s = stateFrom(["P.$....E", "########"]);
    s = run(s, press.right, 40);
    expect(s.goldLeft).toBe(0);
    expect(s.tiles[0]?.charAt(2)).toBe(TILE.empty);
  });

  it("gold is collected once the runner's centre enters its cell", () => {
    const s = stateFrom(["P$.....E", "########"]);
    // Centre still in cell 0 at offset SUB / 2 - 1, in cell 1 at offset SUB / 2.
    expect(stepOne(placeRunner(s, SUB / 2 - 2, 0), press.right).goldLeft).toBe(1);
    expect(stepOne(placeRunner(s, SUB / 2 - 1, 0), press.none).goldLeft).toBe(1);
    expect(stepOne(placeRunner(s, SUB / 2, 0), press.none).goldLeft).toBe(0);
  });

  it("gold is collected while falling through it", () => {
    let s = stateFrom(["P......E", "$.......", "........", "########"]);
    s = run(s, press.none, 40);
    expect(cell(s)).toEqual({ x: 0, y: 2 });
    expect(s.goldLeft).toBe(0);
  });

  it("gold does not block the way and is not support", () => {
    let s = stateFrom(["P$$....E", "########"]);
    s = run(s, press.right, 64);
    expect(cell(s)).toEqual({ x: 4, y: 0 });
    expect(s.goldLeft).toBe(0);
  });

  it("takeGold removes only that gold and leaves other rows untouched", () => {
    const tiles = ["$.$", "..$"];
    expect(takeGold(tiles, 2, 0)).toEqual(["$..", "..$"]);
    expect(takeGold(tiles, 1, 0)).toBeNull();
    expect(takeGold(tiles, 9, 9)).toBeNull();
    expect(tiles).toEqual(["$.$", "..$"]);
  });

  it("centerCell rounds to the cell holding the actor's centre", () => {
    const a = { x: 0, y: 0, facing: 1 as const, busy: 0 };
    expect(centerCell(a)).toEqual({ cx: 0, cy: 0 });
    expect(centerCell({ ...a, x: SUB / 2 })).toEqual({ cx: 1, cy: 0 });
    expect(centerCell({ ...a, y: SUB / 2 - 1 })).toEqual({ cx: 0, cy: 0 });
  });
});

describe("exit", () => {
  it("is not there while gold remains: walking through it does not win", () => {
    let s = stateFrom(["P..E..$.", "########"]);
    s = run(s, press.right, 60);
    expect(cell(s).x).toBeGreaterThan(3);
    expect(s.status).toBe("playing");
    expect(s.goldLeft).toBe(1);
  });

  it("is passable but gives no support: an exit not there yet is fallen through", () => {
    let s = atCell(stateFrom(["P......$", "...E....", "........", "########"]), 3, 0);
    s = run(s, press.none, 40);
    expect(cell(s)).toEqual({ x: 3, y: 2 });
    expect(s.status).toBe("playing");
  });

  it("entering the exit once the last gold is taken completes the level", () => {
    let s = stateFrom(["P.$..E..", "########"]);
    s = run(s, press.right, 30);
    expect(s.goldLeft).toBe(0);
    expect(s.status).toBe("playing");
    s = run(s, press.right, 50);
    expect(s.status).toBe("won");
    expect(centerCell(p1(s))).toEqual({ cx: 5, cy: 0 });
  });

  it("an exit passed earlier appears once the last gold is taken", () => {
    let s = stateFrom(["P.E.$...", "########"]);
    s = run(s, press.right, 64);
    expect(s.goldLeft).toBe(0);
    expect(s.status).toBe("playing");
    s = run(s, press.left, 40);
    expect(s.status).toBe("won");
  });

  it("after the win the state is frozen except for the tick", () => {
    let s = stateFrom(["P$E.....", "########"]);
    s = run(s, press.right, 40);
    expect(s.status).toBe("won");
    const later = run(s, press.left, 30);
    expect({ ...later, tick: s.tick }).toEqual(s);
  });

  it("winning takes precedence over a hole filling on the same tick", () => {
    // Runner in a hole at (1, 1), one sub-unit before its centre enters the open exit at
    // (2, 1), on the last tick of the hole's life. Tick 1 is odd, so start at tick 1 to
    // make the next tick (2) a walking tick.
    const base = stateFrom(["P.......", "#.E#####", "########"]);
    const s = {
      ...withPlayer(base, { x: SUB + SUB / 2 - 1, y: SUB }),
      tick: 1,
      goldLeft: 0,
      holes: [{ cx: 1, cy: 1, age: HOLE_LIFETIME - 1 }],
    };
    const next = stepOne(s, press.right);
    expect(next.holes).toEqual([]);
    expect(p1(next).x).toBe(SUB + SUB / 2);
    expect(next.status).toBe("won");
  });
});
