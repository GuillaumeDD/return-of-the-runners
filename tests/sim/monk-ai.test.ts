import { describe, expect, it } from "vitest";
import { chooseMove, type ChaseView, type MonkMove } from "../../src/sim/ai";
import { SUB } from "../../src/sim/rules";
import { newMonk, type GameState } from "../../src/sim/state";
import { makeRng, randInt } from "../helpers/rng";
import { stateFrom } from "./helpers";

/** The AI's view for a monk at (cx, cy) chasing a runner at (rx, ry), all aligned. */
function viewOf(cx: number, cy: number, rx: number, ry: number, falling = false): ChaseView {
  return { cx, cy, x: cx * SUB, rx, ry, runnerX: rx * SUB, runnerFalling: falling };
}

function move(rows: readonly string[], v: ChaseView): MonkMove {
  return chooseMove(stateFrom(rows), v);
}

describe("monk AI on hand-made levels", () => {
  it("goes straight at the runner along a walkable floor", () => {
    const rows = ["........", "P.......", "########"];
    expect(move(rows, viewOf(5, 1, 0, 1))).toBe("left");
    expect(move(rows, viewOf(0, 1, 6, 1))).toBe("right");
  });

  it("on the same cell, goes toward the runner's side", () => {
    const rows = ["........", "P.......", "########"];
    const v = { ...viewOf(3, 1, 3, 1), x: 3 * SUB + 1, runnerX: 3 * SUB + 3 };
    expect(move(rows, v)).toBe("right");
    expect(move(rows, { ...v, runnerX: 3 * SUB })).toBe("left");
  });

  it("walks along a bar to reach the runner", () => {
    const rows = ["P.......", "--------", "........", "########"];
    expect(move(rows, viewOf(6, 1, 1, 1))).toBe("left");
  });

  it("ignores holes: they count as the brick they were dug in", () => {
    const rows = ["........", "P.......", "########"];
    const s: GameState = { ...stateFrom(rows), holes: [{ cx: 3, cy: 2, age: 100 }] };
    expect(chooseMove(s, viewOf(6, 1, 0, 1))).toBe("left");
  });

  it("does not chase straight across a gap on the same row", () => {
    // Gap under column 3: the straight path fails, so the floor scan decides. The best
    // spot is on the runner's row nearest the monk: going left reaches column 4.
    const rows = ["........", "P.......", "###.####", "########"];
    expect(move(rows, viewOf(6, 1, 0, 1))).toBe("left");
  });

  it("takes the ladder up when the runner is above", () => {
    const rows = ["P.......", "#####H##", ".....H..", "########"];
    expect(move(rows, viewOf(5, 2, 0, 0))).toBe("up");
    expect(move(rows, viewOf(1, 2, 0, 0))).toBe("right");
    expect(move(rows, viewOf(7, 2, 0, 0))).toBe("left");
  });

  it("heads for the edge or ladder that leads down to the runner", () => {
    // Monk on a ledge at row 1; the ledge ends at column 4, and below is the runner's row.
    const rows = ["........", "#####...", "........", "P.......", "########"];
    expect(move(rows, viewOf(1, 0, 0, 3))).toBe("right");
    // Standing on a ladder going down to the runner's row.
    const ladder = ["........", "##H#####", "..H.....", "P.H.....", "########"];
    expect(move(ladder, viewOf(2, 0, 0, 3))).toBe("down");
  });

  it("ignores walls on the runner's row, like the 1982 AI", () => {
    // The original's same-row check only looks at the floor ("ignore walls"), so the
    // monk presses against the wall instead of taking the ladder over it.
    const rows = ["........", "..H#....", "M.H#..P.", "########"];
    expect(move(rows, viewOf(0, 2, 6, 2))).toBe("right");
  });

  it("is deterministic: the same view always gives the same move", () => {
    const rows = ["H......H", "H.####.H", "H......H", "########"];
    const s = stateFrom(rows.map((r, y) => (y === 3 ? "P#######" : r)));
    const v = viewOf(3, 0, 0, 2);
    const first = chooseMove(s, v);
    for (let i = 0; i < 10; i++) expect(chooseMove(s, v)).toBe(first);
  });

  it("stands on another monk's head when chasing across it", () => {
    // Gap under column 3, filled by a monk standing in it: the floor is walkable.
    const rows = ["........", "P.......", "###.####", "########"];
    const s = { ...stateFrom(rows), monks: [newMonk(3, 2)] };
    expect(chooseMove(s, viewOf(6, 1, 0, 1))).toBe("left");
    // Without the monk, the floor scan has to decide (still left, but via the gap).
    expect(chooseMove({ ...s, monks: [] }, viewOf(6, 1, 1, 1))).toBe("left");
  });
});

// --- Naive reference, written separately from the rules in docs/ARCHITECTURE.md -------
// A 2D char grid, no shared helpers with src/sim/ai.ts.

type Grid = string[][];

function cellRef(g: Grid, x: number, y: number): string {
  if (y < 0 || y >= g.length) return "@";
  const row = g[y] ?? [];
  if (x < 0 || x >= row.length) return "@";
  const c = row[x] ?? "@";
  return c === "E" ? "." : c;
}

const WALL = (c: string): boolean => c === "#" || c === "@";
const FOOT = (c: string): boolean => c === "#" || c === "@" || c === "H";

function refMove(g: Grid, monkBodies: Set<string>, v: ChaseView): MonkMove {
  const w = g[0]?.length ?? 0;
  const h = g.length;
  const { cx, cy, rx, ry } = v;

  if (cy === ry && !v.runnerFalling) {
    const step = rx > cx ? 1 : -1;
    let ok = true;
    for (let x = cx; x !== rx; x += step) {
      const here = cellRef(g, x, cy);
      const below = cy < h - 1 ? cellRef(g, x, cy + 1) : "@";
      const fine =
        here === "H" ||
        here === "-" ||
        FOOT(below) ||
        below === "-" ||
        below === "$" ||
        monkBodies.has(`${String(x)},${String(cy + 1)}`);
      if (!fine) {
        ok = false;
        break;
      }
    }
    if (ok) {
      if (cx !== rx) return rx > cx ? "right" : "left";
      return v.x < v.runnerX ? "right" : "left";
    }
  }

  const ratingAt = (x: number, y: number): number =>
    y === ry ? Math.abs(cx - x) : y > ry ? 200 + y - ry : 100 + ry - y;
  const sideOk = (x: number, y: number): boolean =>
    (x - 1 >= 0 && (FOOT(cellRef(g, x - 1, y + 1)) || cellRef(g, x - 1, y) === "-")) ||
    (x + 1 <= w - 1 && (FOOT(cellRef(g, x + 1, y + 1)) || cellRef(g, x + 1, y) === "-"));
  const downEnd = (x: number): number => {
    let y = cy;
    while (y < h - 1 && !WALL(cellRef(g, x, y + 1))) {
      if (cellRef(g, x, y) !== "." && sideOk(x, y) && y >= ry) return y;
      y += 1;
    }
    return y;
  };
  const upEnd = (x: number): number => {
    let y = cy;
    while (y > 0 && cellRef(g, x, y) === "H") {
      y -= 1;
      if (sideOk(x, y) && y <= ry) return y;
    }
    return y;
  };

  // Floor ends.
  let left = cx;
  while (left > 0) {
    const n = cellRef(g, left - 1, cy);
    if (WALL(n)) break;
    left -= 1;
    if (!(n === "H" || n === "-" || cy >= h - 1 || FOOT(cellRef(g, left, cy + 1)))) break;
  }
  let right = cx;
  while (right < w - 1) {
    const n = cellRef(g, right + 1, cy);
    if (WALL(n)) break;
    right += 1;
    if (!(n === "H" || n === "-" || cy >= h - 1 || FOOT(cellRef(g, right, cy + 1)))) break;
  }

  // Candidates in scan order; the first strictly best one wins.
  const candidates: { x: number; move: MonkMove; dir: "down" | "up" }[] = [];
  const column = (x: number, m: MonkMove): void => {
    if (cy < h - 1 && !WALL(cellRef(g, x, cy + 1))) candidates.push({ x, move: m, dir: "down" });
    if (cellRef(g, x, cy) === "H") candidates.push({ x, move: m, dir: "up" });
  };
  if (cy < h - 1 && !WALL(cellRef(g, cx, cy + 1)))
    candidates.push({ x: cx, move: "down", dir: "down" });
  if (cellRef(g, cx, cy) === "H") candidates.push({ x: cx, move: "up", dir: "up" });
  for (let x = left; x < cx; x++) column(x, "left");
  for (let x = right; x > cx; x--) column(x, "right");

  let best = 255;
  let bestMove: MonkMove = "none";
  for (const c of candidates) {
    const y = c.dir === "down" ? downEnd(c.x) : upEnd(c.x);
    const r = ratingAt(c.x, y);
    if (r < best) {
      best = r;
      bestMove = c.move;
    }
  }
  return bestMove;
}

const ALPHABET = [".", ".", ".", ".", "#", "#", "@", "H", "H", "-", "$", "E"];

describe("monk AI vs naive reference (randomized)", () => {
  it("chooses the same move on 2,000 random small levels", () => {
    const rng = makeRng(8);
    for (let i = 0; i < 2000; i++) {
      const w = 3 + randInt(rng, 8);
      const h = 3 + randInt(rng, 6);
      const g: Grid = Array.from({ length: h }, () =>
        Array.from({ length: w }, () => ALPHABET[randInt(rng, ALPHABET.length)] ?? "."),
      );
      const rows = g.map((r) => r.join(""));
      // createState needs a runner marker; put it in a corner and keep the grid as is.
      const s = stateFrom(rows.map((r, y) => (y === 0 ? "P" + r.slice(1) : r)));
      const terrain = { ...s, tiles: rows };
      const bodies = new Set<string>();
      const monks = [];
      if (randInt(rng, 2) === 0) {
        const bx = randInt(rng, w);
        const by = randInt(rng, h);
        monks.push(newMonk(bx, by));
        bodies.add(`${String(bx)},${String(by)}`);
      }
      const v: ChaseView = {
        ...viewOf(randInt(rng, w), randInt(rng, h), randInt(rng, w), randInt(rng, h)),
        runnerFalling: randInt(rng, 4) === 0,
      };
      const where = `level ${JSON.stringify(rows)} view ${JSON.stringify(v)} monks ${JSON.stringify([...bodies])}`;
      expect(chooseMove({ ...terrain, monks }, v), where).toBe(refMove(g, bodies, v));
    }
  });
});
