import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { blastCells } from "../../src/sim/bombs";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import { BLAST_TICKS, CRATER_TICKS, FUSE_TICKS, SUB } from "../../src/sim/rules";
import { newMonk, type GameState } from "../../src/sim/state";
import { step } from "../../src/sim/step";
import { cell, p1, press, run, stateFrom, stepOne, withPlayer } from "./helpers";

const bomb: PlayerInput = { ...NO_INPUT, bomb: true };
const at = (s: GameState, cx: number, cy: number): string => s.tiles[cy]?.charAt(cx) ?? "";
const lit = (s: GameState, cx: number, cy: number, big = false, left = 1): GameState => ({
  ...s,
  fuses: [...s.fuses, { cx, cy, big, left }],
});
/** Cells as "x,y" strings, for compact comparisons. */
const keys = (cells: readonly { cx: number; cy: number }[]): string[] =>
  cells.map((c) => `${String(c.cx)},${String(c.cy)}`);

describe("the bomb counter", () => {
  it("walking over bombs picks them up, in order; monks walk past them", () => {
    let s = stateFrom(["P.o.O....M", "@@@@@@@@@@"]);
    s = { ...s, monks: [newMonk(9, 0)] };
    s = run(s, press.right, 4 * 2 * SUB);
    expect(p1(s).bombs).toBe("oO");
    expect([at(s, 2, 0), at(s, 4, 0)]).toEqual([TILE.empty, TILE.empty]);
    // A monk standing on a bomb leaves it there.
    let m = stateFrom(["P...o.", "@@@@@@"]);
    m = { ...m, monks: [newMonk(4, 0)] };
    expect(at(run(m, NO_INPUT, 10), 4, 0)).toBe(TILE.smallBomb);
  });

  it("the bomb key lays the first bomb picked up, lit, in the player's cell", () => {
    const s = withPlayer(stateFrom(["....P...", "@@@@@@@@"]), { bombs: "Oo" });
    const t = stepOne(s, bomb);
    expect(p1(t).bombs).toBe("o");
    expect(t.fuses).toEqual([{ cx: 4, cy: 0, big: true, left: FUSE_TICKS }]);
  });

  it("with no bomb, the key does nothing", () => {
    const s = stateFrom(["....P...", "@@@@@@@@"]);
    expect(stepOne(s, bomb).fuses).toEqual([]);
  });

  it("acts once per press, and not twice in one cell", () => {
    let s = withPlayer(stateFrom(["....P...", "@@@@@@@@"]), { bombs: "ooo" });
    s = run(s, bomb, 10);
    expect(s.fuses).toHaveLength(1);
    s = stepOne(stepOne(s, NO_INPUT), bomb);
    expect([s.fuses.length, p1(s).bombs]).toEqual([1, "oo"]);
  });

  it("not while falling", () => {
    const s = withPlayer(stateFrom(["P...", "....", "@@@@"]), { bombs: "o", y: 2 });
    expect(stepOne(s, bomb).fuses).toEqual([]);
  });

  it("a player who dies keeps its bombs", () => {
    let s = withPlayer(stateFrom(["P...Q", "@@@@@"], 1, 2), { bombs: "oO" });
    s = withPlayer(s, { mode: "dead", timer: 2 });
    s = step(step(s, []), []);
    expect(p1(s)).toMatchObject({ mode: "alive", bombs: "oO" });
  });
});

describe("blast shapes", () => {
  it("small: its row two cells either side, one cell either side above and below", () => {
    expect(keys(blastCells(3, 3, false, 10, 10))).toEqual([
      "2,2",
      "3,2",
      "4,2",
      "1,3",
      "2,3",
      "3,3",
      "4,3",
      "5,3",
      "2,4",
      "3,4",
      "4,4",
    ]);
  });

  it("big: round, five cells across (dx² + dy² ≤ 5)", () => {
    const cells = keys(blastCells(3, 3, true, 10, 10));
    expect(cells).toHaveLength(21);
    for (const c of ["1,2", "5,4", "3,1", "3,5", "2,1"]) expect(cells).toContain(c);
    for (const c of ["1,1", "5,5", "1,5"]) expect(cells).not.toContain(c);
  });

  it("stays inside the level", () => {
    expect(keys(blastCells(0, 0, false, 4, 4))).toEqual(["0,0", "1,0", "2,0", "0,1", "1,1"]);
  });
});

describe("explosions", () => {
  // Regression (self-review): a laid bomb burnt one tick less than a chain-lit one.
  it("a laid bomb explodes FUSE_TICKS after it is laid", () => {
    let s = withPlayer(stateFrom(["P.......", "########", "@@@@@@@@"]), { bombs: "o" });
    s = stepOne(s, bomb);
    s = run(s, press.right, FUSE_TICKS - 1);
    expect([s.fuses.length, s.blasts.length]).toEqual([1, 0]);
    s = stepOne(s, press.right);
    expect([s.fuses.length, s.blasts.length]).toEqual([0, 1]);
    expect(s.blasts[0]).toMatchObject({ cx: 0, cy: 0, big: false, age: 0 });
    // Drawn for a while, then gone.
    expect(run(s, NO_INPUT, BLAST_TICKS).blasts).toEqual([]);
  });

  it("small: blows brick away for CRATER_TICKS; other terrain is unharmed", () => {
    const rows = ["P.......", "...#@...", "~#####A.", "...H....", "@@@@@@@@"];
    let s = lit(stateFrom(rows), 3, 2);
    s = { ...s, players: [{ ...p1(s), x: 7 * SUB, y: 3 * SUB }] };
    s = stepOne(s, NO_INPUT);
    expect(keys(s.craters)).toEqual(["3,1", "1,2", "2,2", "3,2", "4,2", "5,2"]);
    // The tiles stay: bedrock, goo, the door and the ladder are untouched.
    expect(s.tiles.slice(1, 4)).toEqual(rows.slice(1, 4));
    // Craters read as empty: what stood on them falls.
    expect(s.craters.every((c) => c.left === CRATER_TICKS)).toBe(true);
    s = run(s, NO_INPUT, CRATER_TICKS - 1);
    expect(s.craters).toHaveLength(6);
    s = stepOne(s, NO_INPUT);
    expect(s.craters).toEqual([]);
  });

  it("an actor in a crater when the brick comes back dies", () => {
    // The brick at (2, 1) is blown away; the player then stands in its crater.
    let s = lit(stateFrom(["P......", "###....", "@@@@@@@"]), 3, 0);
    s = stepOne(s, NO_INPUT);
    expect(keys(s.craters)).toEqual(["2,1"]);
    s = withPlayer(s, { x: 2 * SUB, y: SUB });
    s = run(s, NO_INPUT, CRATER_TICKS - 1);
    expect(s.status).toBe("playing");
    s = stepOne(s, NO_INPUT);
    expect(s.status).toBe("dead");
  });

  it("big: destroys terrain for good, bedrock included; not the exit, gold or items", () => {
    const s0 = stateFrom(["P.......", "..H-E...", ".@#~$a..", "..%A....", "@@@@@@@@"]);
    const s = stepOne({ ...lit(s0, 3, 2, true), goldLeft: 1 }, NO_INPUT);
    expect(s.tiles.slice(1, 4)).toEqual(["....E...", "....$a..", "........"]);
    expect(s.craters).toEqual([]);
    // For good: still gone long after.
    expect(run(s, NO_INPUT, CRATER_TICKS + 10).tiles[2]).toBe("....$a..");
  });

  it("a big blast on a crater removes it for good", () => {
    let s = lit(stateFrom(["P.......", "........", "..####..", "@@@@@@@@"]), 3, 1);
    s = stepOne(s, NO_INPUT);
    expect(s.craters.length).toBeGreaterThan(0);
    s = stepOne(lit(s, 3, 1, true), NO_INPUT);
    expect(s.craters).toEqual([]);
    expect(s.tiles[2]).toBe("........");
  });

  it("a player or a monk in the blast dies; one outside it lives", () => {
    const rows = ["P.........", "@@@@@@@@@@"];
    // Bomb at (2, 0): the blast covers columns 0–4 of row 0.
    const near = stepOne(lit(stateFrom(rows), 2, 0), NO_INPUT);
    expect(near.status).toBe("dead");
    const far = stepOne(lit(withPlayer(stateFrom(rows), { x: 5 * SUB }), 2, 0), NO_INPUT);
    expect(far.status).toBe("playing");
    let m = withPlayer(stateFrom(rows), { x: 9 * SUB });
    m = { ...m, monks: [{ ...newMonk(3, 0), mode: "trapped", timer: 50, holeX: 3, holeY: 0 }] };
    m = stepOne(lit(m, 2, 0), NO_INPUT);
    expect(m.monks[0]?.mode).toBe("dead");
  });

  it("the player who lays a bomb and stays dies; one who runs gets away", () => {
    const s = withPlayer(stateFrom(["P.........", "@@@@@@@@@@"]), { bombs: "o" });
    expect(run(stepOne(s, bomb), NO_INPUT, FUSE_TICKS).status).toBe("dead");
    const ran = run(stepOne(s, bomb), press.right, FUSE_TICKS);
    expect(ran.status).toBe("playing");
    expect(cell(ran).x).toBeGreaterThan(2);
  });

  it("a blast lights the bombs lying in it: each explodes one fuse later", () => {
    // Bombs lying 2 and 4 cells right of the first: a chain along the row.
    let s = withPlayer(stateFrom(["P.........", "@@@@@@@@@@"]), { x: 9 * SUB });
    s = { ...s, tiles: ["..o.O.....", "@@@@@@@@@@"] };
    s = stepOne(lit(s, 0, 0), NO_INPUT);
    expect(s.fuses).toEqual([{ cx: 2, cy: 0, big: false, left: FUSE_TICKS }]);
    expect(s.tiles[0]).toBe("....O.....");
    s = run(s, NO_INPUT, FUSE_TICKS);
    expect(s.blasts.at(-1)).toMatchObject({ cx: 2, big: false, age: 0 });
    expect(s.fuses).toEqual([{ cx: 4, cy: 0, big: true, left: FUSE_TICKS }]);
    s = run(s, NO_INPUT, FUSE_TICKS);
    expect(s.blasts.at(-1)).toMatchObject({ cx: 4, big: true, age: 0 });
    expect(s.fuses).toEqual([]);
  });

  it("a bomb already burning in a blast keeps its fuse", () => {
    let s = withPlayer(stateFrom(["P.........", "@@@@@@@@@@"]), { x: 9 * SUB });
    s = lit(lit(s, 2, 0), 3, 0, false, 60);
    s = stepOne(s, NO_INPUT);
    expect(s.fuses).toEqual([{ cx: 3, cy: 0, big: false, left: 59 }]);
  });

  // Regression (self-review): a monk dropped gold over a crater, which `tiles` still
  // shows as brick.
  it("a monk does not drop gold over a crater", () => {
    let s = withPlayer(stateFrom(["P.........", "##########", "@@@@@@@@@@"]), { x: 9 * SUB });
    s = stepOne(lit(s, 4, 0), NO_INPUT);
    expect(keys(s.craters)).toEqual(["3,1", "4,1", "5,1"]);
    // A monk carrying gold, due to drop it on its next cell, walks over the craters'
    // row from the left: it holds the gold until it is past them.
    let m: GameState = {
      ...s,
      players: [{ ...p1(s), x: 9 * SUB }],
      monks: [{ ...newMonk(2, 0), carry: 1 }],
    };
    for (let i = 0; i < 30; i++) m = stepOne(m, NO_INPUT);
    expect(m.tiles[0]?.slice(3, 6)).not.toContain(TILE.gold);
  });

  it("bombs going off on one tick explode in the order they were lit", () => {
    let s = withPlayer(stateFrom(["P.........", "@@@@@@@@@@"]), { x: 9 * SUB });
    s = lit(lit(s, 6, 0), 1, 0, true);
    s = stepOne(s, NO_INPUT);
    expect(s.blasts.map((b) => [b.cx, b.big])).toEqual([
      [6, false],
      [1, true],
    ]);
  });

  it("a blast clears rubble and holes in it", () => {
    let s = withPlayer(stateFrom(["P.........", "####......", "@@@@@@@@@@"]), { x: 9 * SUB });
    s = {
      ...s,
      holes: [{ cx: 1, cy: 1, age: 20 }],
      rubble: [{ cx: 3, y: 0, landed: 4 }],
    };
    s = stepOne(lit(s, 2, 0), NO_INPUT);
    expect(s.holes).toEqual([]);
    expect(s.rubble).toEqual([]);
    expect(keys(s.craters)).toEqual(["1,1", "2,1", "3,1"]);
  });
});
