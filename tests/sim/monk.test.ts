import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { centerCell } from "../../src/sim/gold";
import { HOLE_LIFETIME } from "../../src/sim/holes";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import { respawnCell } from "../../src/sim/monks";
import { HOLE_TICKS, MONK_CARRY, MONK_PERIOD, MONK_TICKS, SUB } from "../../src/sim/rules";
import type { GameState, Monk } from "../../src/sim/state";
import { step } from "../../src/sim/step";
import { atCell, press, run, stateFrom } from "./helpers";

const digRight: PlayerInput = { ...NO_INPUT, digRight: true };

function monk(s: GameState, i = 0): Monk {
  const m = s.monks[i];
  if (m === undefined) throw new Error(`no monk ${String(i)}`);
  return m;
}

function monkCell(s: GameState, i = 0): { x: number; y: number } {
  const { cx, cy } = centerCell(monk(s, i));
  return { x: cx, y: cy };
}

describe("monks: setup and movement", () => {
  it("are created from M markers in reading order, on empty cells", () => {
    const s = stateFrom(["M......M", "P..M....", "########"]);
    expect(s.monks.map((m) => [m.x / SUB, m.y / SUB])).toEqual([
      [0, 0],
      [7, 0],
      [3, 1],
    ]);
    expect(s.tiles[0]).toBe("........");
    expect(s.monks.every((m) => m.mode === "free" && m.carry === 0)).toBe(true);
  });

  // Regression (B-019 self-review): the player 2 start stayed in the terrain.
  it("a player 2 start marker is an empty cell, like the other start markers", () => {
    const s = stateFrom(["M..Q....", "P.......", "########"]);
    expect(s.tiles[0]).toBe("........");
    expect(s.tiles[0]?.includes(TILE.player2Start)).toBe(false);
  });

  it("walk at MONK_PERIOD.walk: one sub-unit every walk period", () => {
    // Runner far left on the same floor: the monk walks straight at it.
    let s = stateFrom(["P..............M", "################"]);
    const x0 = monk(s).x;
    const ticks = MONK_PERIOD.walk * 12;
    s = run(s, press.none, ticks);
    expect(monk(s).x).toBe(x0 - 12);
  });

  it("fall at MONK_PERIOD.fall when unsupported", () => {
    let s = stateFrom(["P......M", "........", "........", "########"]);
    s = run(s, press.none, MONK_PERIOD.fall * SUB);
    expect(monk(s).y).toBe(SUB);
    expect(monk(s).x).toBe(7 * SUB);
  });

  it("climb ladders toward the runner, with the runner's movement rules", () => {
    let s = stateFrom(["P.......", "#####H##", ".....HM.", "########"]);
    s = run(s, press.none, 400);
    // The monk climbed and reached the runner's row, then caught it.
    expect(monkCell(s).y).toBe(0);
    expect(s.status).toBe("dead");
  });

  it("never overlap each other", () => {
    let s = stateFrom(["P.........MMM", "#############"]);
    for (let t = 0; t < 300; t++) {
      s = step(s, press.none);
      const [a, b, c] = s.monks;
      if (a === undefined || b === undefined || c === undefined) throw new Error("monks");
      for (const [p, q] of [
        [a, b],
        [b, c],
        [a, c],
      ] as const) {
        expect(Math.abs(p.x - q.x) >= SUB || Math.abs(p.y - q.y) >= SUB).toBe(true);
      }
    }
  });
});

describe("monks and the runner", () => {
  it("a monk touching the runner catches it", () => {
    let s = stateFrom(["P.....M.", "########"]);
    s = run(s, press.none, 200);
    expect(s.status).toBe("dead");
  });

  it("the runner can stand on a monk's head", () => {
    // Runner above a monk stuck in a pit: it stands on the monk instead of falling.
    const s = stateFrom(["...P....", "...M....", "########"].map((r) => r));
    const pit = { ...s, monks: [{ ...monk(s), mode: "trapped" as const, timer: 1000 }] };
    const later = run(pit, press.none, 30);
    expect(later.runner.y).toBe(0);
    expect(later.status).toBe("playing");
  });

  it("a monk blocks digging under it", () => {
    const s = stateFrom(["........", "...P....", "########"]);
    const withMonk = {
      ...s,
      monks: [{ ...monk(stateFrom(["....M...", "P.......", "########"])), y: SUB }],
    };
    // Monk at (4, 1) stands over the target (4, 2).
    expect(step(withMonk, digRight).holes).toEqual([]);
  });
});

describe("monks and holes", () => {
  // Runner digs at (4, 2) and steps back; a monk comes from the right along row 1.
  const pitRows = ["........", "...P...M", "########", "########"];

  function trappedState(): GameState {
    let s = step(stateFrom(pitRows), digRight);
    s = run(s, press.none, HOLE_TICKS.digging);
    for (let t = 0; t < 400 && monk(s).mode !== "trapped"; t++) s = step(s, press.none);
    return s;
  }

  it("a monk walking over an open hole falls in and is trapped, aligned in it", () => {
    const s = trappedState();
    expect(monk(s).mode).toBe("trapped");
    expect(monkCell(s)).toEqual({ x: 4, y: 2 });
    expect(monk(s).x % SUB).toBe(0);
    expect(monk(s).y % SUB).toBe(0);
    expect(s.status).toBe("playing");
  });

  it("stays trapped for MONK_TICKS.trapped ticks, then climbs out and leaves the column", () => {
    let s = trappedState();
    const pos = { x: monk(s).x, y: monk(s).y };
    s = run(s, press.none, MONK_TICKS.trapped - 1);
    expect(monk(s).mode).toBe("trapped");
    expect({ x: monk(s).x, y: monk(s).y }).toEqual(pos);
    s = step(s, press.none);
    expect(monk(s).mode).toBe("escaping");
    for (let t = 0; t < 200 && monk(s).mode === "escaping"; t++) s = step(s, press.none);
    expect(monk(s).mode).toBe("free");
    expect(monkCell(s).y).toBe(1);
    expect(monkCell(s).x).not.toBe(4);
  });

  it("drops the gold it carries on top of the hole when trapped", () => {
    // The monk walks over gold at (6, 1) on its way to the hole at (4, 2).
    const rows = ["........", "...P..$M", "########", "########"];
    let s = step(stateFrom(rows), digRight);
    for (let t = 0; t < 30 && monk(s).carry === 0; t++) s = step(s, press.none);
    expect(monk(s).carry).toBeGreaterThanOrEqual(MONK_CARRY.min);
    expect(monk(s).carry).toBeLessThan(MONK_CARRY.min + MONK_CARRY.spread);
    expect(s.tiles[1]?.charAt(6)).toBe(TILE.empty);
    expect(s.goldLeft).toBe(1);
    for (let t = 0; t < 400 && monk(s).mode !== "trapped"; t++) s = step(s, press.none);
    expect(monk(s).mode).toBe("trapped");
    expect(monk(s).carry).toBe(-2);
    expect(s.tiles[1]?.charAt(4)).toBe(TILE.gold);
  });

  // Regression (self-review): the trapped monk used to pick its dropped gold back up
  // while climbing out through it.
  it("leaves the dropped gold behind when it climbs out", () => {
    const rows = ["........", "...P..$M", "########", "########"];
    let s = step(stateFrom(rows), digRight);
    for (let t = 0; t < 400 && monk(s).mode !== "trapped"; t++) s = step(s, press.none);
    // Keep the runner out of reach so the monk climbs out and walks away.
    s = { ...s, runner: { ...s.runner, x: 0, y: 0 } };
    for (let t = 0; t < 400 && monk(s).mode !== "free"; t++) s = step(s, press.none);
    expect(monk(s).mode).toBe("free");
    s = run(s, press.none, 30);
    expect(s.tiles[1]?.charAt(4)).toBe(TILE.gold);
    expect(monk(s).carry).toBeLessThanOrEqual(0);
  });

  // Regression (self-review): a blocked step used to undo the move but keep the switch
  // from "escaping" to "free".
  it("a step out of the hole blocked by another monk keeps the monk escaping", () => {
    const base = stateFrom(["........", "P.....M.", "########", "########"]);
    const escaping: Monk = {
      ...monk(base),
      x: 2 * SUB + 3,
      y: SUB,
      mode: "escaping",
      holeX: 2,
      holeY: 2,
    };
    const blocker: Monk = { ...monk(base), x: 3 * SUB + 3, y: SUB, mode: "trapped", timer: 10_000 };
    let s: GameState = {
      ...base,
      runner: { ...base.runner, x: 7 * SUB, y: SUB },
      holes: [{ cx: 2, cy: 2, age: 100 }],
      monks: [escaping, blocker],
    };
    s = run(s, press.none, 12);
    expect(monk(s).mode).toBe("escaping");
    expect(monk(s).holeX).toBe(2);
    expect(monk(s).x).toBe(2 * SUB + 3);
  });

  // Regression (self-review): walled in on both sides, an escaping monk used to float
  // above its hole forever.
  it("walled in above its hole, an escaping monk falls back in", () => {
    const base = stateFrom(["P.......", ".#.#....", "########"]);
    const s0: GameState = {
      ...base,
      holes: [{ cx: 2, cy: 2, age: 100 }],
      monks: [
        {
          ...monk(stateFrom(["P.M.....", "........", "........"])),
          y: SUB,
          mode: "escaping",
          holeX: 2,
          holeY: 2,
        },
      ],
    };
    const s = run(s0, press.none, 20);
    expect(monk(s).mode).toBe("trapped");
    expect(monkCell(s)).toEqual({ x: 2, y: 2 });
  });

  it("a monk inside a hole when it refills dies, then reappears near the top", () => {
    let s = trappedState();
    // Keep it trapped until the hole fills: freeze its timer.
    s = { ...s, monks: [{ ...monk(s), timer: 10_000 }] };
    const age = s.holes[0]?.age ?? 0;
    s = run(s, press.none, HOLE_LIFETIME - age);
    expect(s.holes).toEqual([]);
    expect(monk(s).mode).toBe("dead");
    expect(s.status).toBe("playing");
    s = run(s, press.none, MONK_TICKS.respawn - 1);
    expect(monk(s).mode).toBe("dead");
    s = step(s, press.none);
    expect(monk(s).mode).toBe("free");
    expect(monkCell(s).y).toBe(1);
  });

  it("respawn: second row from a PRNG column, skipping taken cells, wrapping, then lower", () => {
    const s = stateFrom(["........", "P.......", "........", "########"]);
    const a = respawnCell(s, s.runner, 7);
    const b = respawnCell(s, s.runner, 7);
    expect(a).toEqual(b);
    expect(a.cell?.cy).toBe(1);
    // A full second row sends it to the third.
    const full = { ...s, tiles: ["........", "########", "........", "########"] };
    expect(respawnCell(full, full.runner, 7).cell?.cy).toBe(2);
    // The runner's cell is never chosen.
    const one = { ...s, tiles: ["........", "P#######".replace("P", "."), "########", "########"] };
    const runnerThere = atCell(one, 0, 1);
    expect(respawnCell(runnerThere, runnerThere.runner, 3).cell).toBeNull();
  });
});

describe("monks and gold", () => {
  it("a monk carrying gold drops it on free floor once its count runs out", () => {
    let s = stateFrom(["P..............M", "################"]);
    s = { ...s, monks: [{ ...monk(s), carry: 2 }] };
    // First arrival in a new cell: 2 -> 1. Second: drops the gold there.
    let drops = 0;
    for (let t = 0; t < 80 && drops === 0; t++) {
      s = step(s, press.none);
      drops = s.tiles[0]?.split("").filter((c) => c === TILE.gold).length ?? 0;
    }
    expect(drops).toBe(1);
    expect(monk(s).carry).toBe(-1);
    expect(s.tiles[0]?.charAt(monkCell(s).x)).toBe(TILE.gold);
  });

  it("after dropping, waits one cell before picking gold up again", () => {
    let s = stateFrom(["P..............M", "################"]);
    s = { ...s, monks: [{ ...monk(s), carry: -1 }] };
    for (let t = 0; t < 40 && monk(s).carry !== 0; t++) s = step(s, press.none);
    expect(monk(s).carry).toBe(0);
  });

  it("gold carried by a monk still counts as gold left (the exit stays locked)", () => {
    let s = stateFrom(["P....$.M", "########"]);
    for (let t = 0; t < 60 && monk(s).carry === 0; t++) s = step(s, press.none);
    expect(monk(s).carry).toBeGreaterThan(0);
    expect(s.goldLeft).toBe(1);
  });
});
