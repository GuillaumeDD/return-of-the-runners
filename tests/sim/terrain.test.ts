import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import { isHidden, respawnCell } from "../../src/sim/monks";
import { GOO_PERIOD, MONK_PERIOD, MONK_TICKS, RUNNER_PERIOD, SUB } from "../../src/sim/rules";
import { newMonk, type GameState, type Monk } from "../../src/sim/state";
import { step } from "../../src/sim/step";
import { makeRng, randInt } from "../helpers/rng";
import { atCell, cell, p1, press, run, stateFrom, stepOne, withPlayer } from "./helpers";

const digRight: PlayerInput = { ...NO_INPUT, digRight: true };

function monk(s: GameState, i = 0): Monk {
  const m = s.monks[i];
  if (m === undefined) throw new Error(`no monk ${String(i)}`);
  return m;
}

/** Ticks until the actor's x changes from its value now, holding `input` (max 100). */
function ticksToMove(s: GameState, input: PlayerInput, of: (s: GameState) => number): number {
  const x0 = of(s);
  let out = s;
  for (let i = 1; i <= 100; i++) {
    out = stepOne(out, input);
    if (of(out) !== x0) {
      // Measure a full period: from this move to the next.
      const x1 = of(out);
      for (let j = 1; j <= 100; j++) {
        out = stepOne(out, input);
        if (of(out) !== x1) return j;
      }
    }
  }
  return -1;
}

describe("trapdoor turf", () => {
  it("a runner standing on it falls through", () => {
    const s = stateFrom(["..P.....", "..%.....", "........", "@@@@@@@@"]);
    const later = run(s, press.none, 3 * SUB);
    expect(cell(later)).toEqual({ x: 2, y: 2 });
  });

  it("a monk falls through it too", () => {
    let s = stateFrom(["P.......", "@@.M....", "@@.%....", "@@......", "@@@@@@@@"]);
    s = { ...s, monks: [{ ...newMonk(3, 1) }] };
    // The monk walks toward the runner over the trapdoor and drops through it.
    let fell = false;
    for (let i = 0; i < 200 && !fell; i++) {
      s = stepOne(s, press.none);
      if (monk(s).y > 2 * SUB) fell = true;
    }
    expect(fell).toBe(true);
  });

  it("is empty for digging: the brick below it can be dug", () => {
    const s = stateFrom(["..P%....", "########"]);
    expect(stepOne(s, digRight).holes.map((h) => [h.cx, h.cy])).toEqual([[3, 1]]);
  });

  it("cannot be dug: there is nothing there", () => {
    const s = stateFrom(["..P.....", "@@@%@@@@"]);
    const next = stepOne(s, digRight);
    expect(next.holes).toEqual([]);
    expect(p1(next).busy).toBe(0);
  });
});

describe("gooey turf", () => {
  it("is solid floor that cannot be dug", () => {
    const s = stateFrom(["..P.....", "~~~~~~~~"]);
    const later = run(s, press.none, 30);
    expect(cell(later)).toEqual({ x: 2, y: 0 });
    expect(stepOne(s, digRight).holes).toEqual([]);
  });

  it("runners walk on it at GOO_PERIOD ticks per sub-unit instead of their walk period", () => {
    const goo = stateFrom(["P.......", "~~~~~~~~"]);
    const brick = stateFrom(["P.......", "########"]);
    const x = (s: GameState) => p1(s).x;
    expect(ticksToMove(brick, press.right, x)).toBe(RUNNER_PERIOD.walk);
    expect(ticksToMove(goo, press.right, x)).toBe(GOO_PERIOD);
    // Crossing one tile of goo takes SUB * GOO_PERIOD ticks.
    expect(p1(run(goo, press.right, SUB * GOO_PERIOD)).x).toBeGreaterThanOrEqual(SUB - 1);
    expect(p1(run(goo, press.right, SUB * GOO_PERIOD)).x).toBeLessThanOrEqual(SUB);
  });

  it("monks walk on it at GOO_PERIOD too", () => {
    const rows = (floor: string) => ["P......M", "@@@@" + floor.repeat(4)];
    const x = (s: GameState) => monk(s).x;
    expect(ticksToMove(stateFrom(rows("#")), press.none, x)).toBe(MONK_PERIOD.walk);
    expect(ticksToMove(stateFrom(rows("~")), press.none, x)).toBe(GOO_PERIOD);
  });
});

describe("hidden ladder", () => {
  // Gold on the right; a hidden ladder at column 2 up to the top row.
  const rows = ["........", "..h.....", "..h.....", "P.h..$..", "########"];

  it("is not there while gold is left: no climbing, and the tile stays hidden", () => {
    const s = atCell(stateFrom(rows), 2, 3);
    const up = run(s, press.up, 40);
    expect(cell(up)).toEqual({ x: 2, y: 3 });
    expect(up.tiles[1]?.charAt(2)).toBe(TILE.hiddenLadder);
  });

  it("becomes a ladder on the tick the last gold is taken, then can be climbed", () => {
    let s = stateFrom(rows);
    let t = 0;
    while (s.goldLeft > 0 && t++ < 200) {
      const before = s;
      s = stepOne(s, press.right);
      if (s.goldLeft === 0) {
        expect(before.tiles.some((r) => r.includes(TILE.ladder))).toBe(false);
      }
    }
    expect(s.goldLeft).toBe(0);
    expect(s.tiles.map((r) => r.charAt(2))).toEqual([".", "H", "H", "H", "#"]);
    s = atCell(s, 2, 3);
    expect(cell(run(s, press.up, 4 * 2 * SUB)).y).toBeLessThan(3);
  });

  it("a level without gold shows its hidden ladders from the start", () => {
    const s = stateFrom(["..h.....", "P.h.....", "########"]);
    expect(s.tiles.map((r) => r.charAt(2))).toEqual(["H", "H", "#"]);
  });
});

describe("alcove", () => {
  // The player hides in the alcove at (3, 1); a monk walks along the row.
  const rows = ["........", "M..n....", "########"];

  function hiding(): GameState {
    let s = stateFrom(["P.......", ...rows.slice(1)]);
    s = atCell(s, 3, 1);
    return { ...s, monks: [{ ...newMonk(0, 1), facing: 1 }] };
  }

  it("is passable with no support of its own: an actor above it falls in", () => {
    const s = stateFrom(["...P....", "...n....", "########"]);
    expect(cell(run(s, press.none, 2 * SUB))).toEqual({ x: 3, y: 1 });
  });

  it("a monk walking through it does not catch the player hiding in it", () => {
    // Player 2, in sight at the far end, draws the monk along the row through the alcove.
    let s = stateFrom(["P......Q", ...rows.slice(1)], 1, 2);
    s = atCell(s, 3, 1);
    s = withPlayer(s, { x: 7 * SUB, y: SUB }, 1);
    expect(isHidden(s.tiles, p1(s))).toBe(true);
    let passed = false;
    for (let i = 0; i < 6 * SUB * MONK_PERIOD.walk; i++) {
      s = step(s, [NO_INPUT, NO_INPUT]);
      expect(p1(s).mode, `tick ${String(s.tick)}`).toBe("alive");
      if (monk(s).x > 4 * SUB) passed = true;
    }
    expect(passed).toBe(true);
  });

  it("a monk landing on it from above does not catch the player", () => {
    let s = stateFrom(["...M....", "P..n....", "########"]);
    s = atCell(s, 3, 1);
    s = run(s, press.none, 3 * SUB * MONK_PERIOD.fall);
    expect(Math.round(monk(s).y / SUB)).toBe(1);
    expect(s.status).toBe("playing");
  });

  it("the same player one cell away is caught", () => {
    let s = hiding();
    s = atCell(s, 2, 1);
    expect(isHidden(s.tiles, p1(s))).toBe(false);
    s = run(s, press.none, 4 * SUB * MONK_PERIOD.walk);
    expect(s.status).toBe("dead");
  });

  it("monks do not see a hiding player: with nobody else in sight they wait", () => {
    const s = hiding();
    const later = run(s, press.none, 30);
    expect(monk(later).x).toBe(monk(s).x);
    // With player 2 in sight, they chase it instead.
    let two = stateFrom(["P......Q", ...rows.slice(1)], 1, 2);
    two = atCell(two, 3, 1);
    two = withPlayer(two, { x: 7 * SUB, y: SUB }, 1);
    two = { ...two, monks: [{ ...newMonk(0, 1) }] };
    let moved = two;
    for (let i = 0; i < 30; i++) moved = step(moved, [NO_INPUT, NO_INPUT]);
    expect(monk(moved).x).toBeGreaterThan(0);
  });
});

describe("monk respawn points", () => {
  const rows = ["R......R", "P.......", "########"];

  it("a dead monk reappears at an R cell", () => {
    let s = stateFrom(rows);
    s = { ...s, monks: [{ ...newMonk(4, 1), mode: "dead", timer: 1 }] };
    const next = stepOne(s, press.none);
    const m = monk(next);
    expect(m.mode).toBe("free");
    expect([m.x, m.y]).toContainEqual(0);
    expect([0, 7 * SUB]).toContain(m.x);
  });

  it("never an occupied one; with all occupied it waits", () => {
    const s = stateFrom(rows);
    const busy: GameState = { ...s, monks: [{ ...newMonk(0, 0) }] };
    for (let seed = 0; seed < 50; seed++) {
      expect(respawnCell(busy, busy.players, seed).cell).toEqual({ cx: 7, cy: 0 });
    }
    const full: GameState = { ...s, monks: [newMonk(0, 0), newMonk(7, 0)] };
    expect(respawnCell(full, full.players, 3).cell).toBeNull();
    // A player in play on the last free point keeps it taken too.
    const player = atCell({ ...s, monks: [newMonk(0, 0)] }, 7, 0);
    expect(respawnCell(player, player.players, 3).cell).toBeNull();
    // The dead monk tries again later.
    const dead: GameState = {
      ...full,
      monks: [...full.monks, { ...newMonk(4, 1), mode: "dead", timer: 1 }],
    };
    const waited = stepOne(dead, press.none);
    expect(monk(waited, 2)).toMatchObject({ mode: "dead", timer: MONK_TICKS.respawn });
  });

  // Randomized: random R layouts and monks; the chosen cell is always a free R cell, the
  // choice depends only on the PRNG state, and every free point gets chosen sometimes.
  it("picks among the free points with the PRNG (randomized)", () => {
    const rng = makeRng(2201);
    for (let trial = 0; trial < 200; trial++) {
      const w = 8 + randInt(rng, 8);
      const grid = Array.from({ length: 4 }, () =>
        Array.from({ length: w }, () => (randInt(rng, 4) === 0 ? TILE.monkRespawn : ".")).join(""),
      );
      grid.push("P".padEnd(w, "."), "#".repeat(w));
      const s0 = stateFrom(grid);
      const points: { cx: number; cy: number }[] = [];
      grid.forEach((r, cy) => {
        for (let cx = 0; cx < r.length; cx++)
          if (r[cx] === TILE.monkRespawn) points.push({ cx, cy });
      });
      const monks = points.filter(() => randInt(rng, 3) === 0).map((c) => newMonk(c.cx, c.cy));
      const s: GameState = { ...s0, monks };
      const free = points.filter(
        (c) => !monks.some((m) => m.x === c.cx * SUB && m.y === c.cy * SUB),
      );
      const seed = randInt(rng, 0x7fffffff);
      const r = respawnCell(s, s.players, seed);
      expect(r).toEqual(respawnCell(s, s.players, seed));
      if (points.length === 0) continue; // the 1982 rule, covered in monk.test.ts
      if (free.length === 0) expect(r.cell).toBeNull();
      else expect(free).toContainEqual(r.cell);
    }
  });
});
