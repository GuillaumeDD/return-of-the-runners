import { describe, expect, it } from "vitest";
import { TILE } from "../../src/level/format";
import { HOLE_LIFETIME } from "../../src/sim/holes";
import { NO_INPUT, type PlayerInput } from "../../src/sim/input";
import { PLAYER_RESPAWN_TICKS, START_LIVES, SUB } from "../../src/sim/rules";
import { createState, maxPlayers, newMonk, type GameState } from "../../src/sim/state";
import { step } from "../../src/sim/step";
import { levelFrom, p1, press, stateFrom, withPlayer } from "./helpers";

const p2 = (s: GameState) => p1(s, 1);
const digRight: PlayerInput = { ...NO_INPUT, digRight: true };
const digLeft: PlayerInput = { ...NO_INPUT, digLeft: true };

function runBoth(s: GameState, a: PlayerInput, b: PlayerInput, ticks: number): GameState {
  let out = s;
  for (let i = 0; i < ticks; i++) out = step(out, [a, b]);
  return out;
}

/** A state where a monk stands on player `index`'s cell: it catches it on the next tick. */
function monkOn(s: GameState, index: number): GameState {
  const p = p1(s, index);
  return { ...s, monks: [{ ...newMonk(0, 0), x: p.x, y: p.y }] };
}

const flat = ["P......Q", "########"];

describe("two players: setup", () => {
  it("builds players from P then Q, each with START_LIVES lives and no gold", () => {
    const s = stateFrom(["..P.....", "......Q.", "########"], 1, 2);
    expect(s.players.map((p) => [p.x / SUB, p.y / SUB])).toEqual([
      [2, 0],
      [6, 1],
    ]);
    for (const p of s.players) {
      expect(p).toMatchObject({ mode: "alive", lives: START_LIVES, gold: 0, timer: 0 });
      expect([p.startX, p.startY]).toEqual([p.x, p.y]);
    }
    // Start markers are empty cells.
    expect(s.tiles[1]?.charAt(6)).toBe(TILE.empty);
  });

  it("with one player, the player 2 start is ignored (an empty cell)", () => {
    const s = stateFrom(flat);
    expect(s.players).toHaveLength(1);
    expect(s.tiles[0]).toBe("........");
  });

  it("two players need a player 2 start; maxPlayers tells which levels allow two", () => {
    expect(() => stateFrom(["P.......", "########"], 1, 2)).toThrow();
    expect(maxPlayers(levelFrom(["P.......", "########"]))).toBe(1);
    expect(maxPlayers(levelFrom(flat))).toBe(2);
  });
});

describe("two players: controls and terrain", () => {
  it("each player moves only with its own input", () => {
    const s = stateFrom(flat, 1, 2);
    const a = runBoth(s, press.right, NO_INPUT, 16);
    expect(p1(a).x).toBe(SUB);
    expect(p2(a).x).toBe(p2(s).x);
    const b = runBoth(s, NO_INPUT, press.left, 16);
    expect(p1(b).x).toBe(0);
    expect(p2(b).x).toBe(p2(s).x - SUB);
    // A missing input is no input.
    expect(p2(step(s, [press.right])).x).toBe(p2(s).x);
  });

  it("both players can dig on the same tick, but not the same brick twice", () => {
    const s = stateFrom(["..P..Q..", "########"], 1, 2);
    const both = step(s, [digRight, digLeft]);
    expect(both.holes.map((h) => [h.cx, h.cy])).toEqual([
      [3, 1],
      [4, 1],
    ]);
    const same = stateFrom(["..P.Q...", "########"], 1, 2);
    const once = step(same, [digRight, digLeft]);
    expect(once.holes.map((h) => [h.cx, h.cy])).toEqual([[3, 1]]);
    expect(p2(once).busy).toBe(0); // its dig was refused, so it is free
  });

  it("players do not block each other: they share a cell and a hole", () => {
    const s = stateFrom(["P.Q.....", "########"], 1, 2);
    const met = runBoth(s, press.right, press.left, 16);
    expect(p1(met).x).toBe(p2(met).x);
    expect(met.status).toBe("playing");
    // Both fall into the same open hole.
    const pit = stateFrom(["P.Q.....", "########", "########"], 1, 2);
    let h: GameState = { ...pit, holes: [{ cx: 1, cy: 1, age: 50 }] };
    h = runBoth(h, press.right, press.left, 16);
    h = runBoth(h, NO_INPUT, NO_INPUT, 16);
    expect([p1(h).y, p2(h).y]).toEqual([SUB, SUB]);
    expect([p1(h).x, p2(h).x]).toEqual([SUB, SUB]);
  });

  it("a player's body is not floor for the other (it falls past it)", () => {
    const s = stateFrom(["Q.......", "........", "P.......", "########"], 1, 2);
    const later = runBoth(s, NO_INPUT, NO_INPUT, 40);
    expect(p2(later).y).toBe(2 * SUB);
  });
});

describe("two players: gold and exit", () => {
  it("gold taken by either lowers the shared goldLeft and counts for that player", () => {
    const s = stateFrom(["P$...$Q.", "########"], 1, 2);
    expect(s.goldLeft).toBe(2);
    const a = runBoth(s, press.right, NO_INPUT, 16);
    expect(a.goldLeft).toBe(1);
    expect([p1(a).gold, p2(a).gold]).toEqual([1, 0]);
    const b = runBoth(a, NO_INPUT, press.left, 16);
    expect(b.goldLeft).toBe(0);
    expect([p1(b).gold, p2(b).gold]).toEqual([1, 1]);
  });

  it("the exit opens for both: either player reaching it wins the level", () => {
    const s = { ...stateFrom(["P..E..Q.", "########"], 1, 2), goldLeft: 0 };
    expect(runBoth(s, press.right, NO_INPUT, 48).status).toBe("won");
    expect(runBoth(s, NO_INPUT, press.left, 48).status).toBe("won");
    // Locked while gold is left.
    expect(runBoth({ ...s, goldLeft: 1 }, press.right, NO_INPUT, 48).status).toBe("playing");
  });

  it("a player taking the last gold opens the exit for the other on the same tick", () => {
    // Player 1 is about to take the last gold; player 2 already stands on the exit.
    const s = withPlayer(stateFrom(["P$..E..Q", "########"], 1, 2), { x: 4 * SUB }, 1);
    const next = runBoth(s, press.right, NO_INPUT, 16);
    expect(next.status).toBe("won");
  });

  it("a dead player cannot win: its body on the exit does not count", () => {
    let s = withPlayer(stateFrom(["P...E..Q", "########"], 1, 2), { x: 4 * SUB }, 1);
    s = withPlayer({ ...s, goldLeft: 0 }, { mode: "dead", timer: 50 }, 1);
    expect(step(s, []).status).toBe("playing");
  });
});

describe("two players: deaths and lives", () => {
  it("a caught player loses one of its own lives and waits; the other is untouched", () => {
    const s = monkOn(stateFrom(flat, 1, 2), 1);
    const before = p1(s);
    const next = step(s, []);
    expect(next.status).toBe("playing");
    expect(p2(next)).toMatchObject({
      mode: "dead",
      lives: START_LIVES - 1,
      timer: PLAYER_RESPAWN_TICKS,
    });
    expect(p1(next)).toEqual(before);
  });

  it("the dead player reappears at its start PLAYER_RESPAWN_TICKS later, the game going on", () => {
    let s = withPlayer(
      stateFrom(flat, 1, 2),
      { x: 4 * SUB, mode: "dead", timer: PLAYER_RESPAWN_TICKS },
      1,
    );
    s = runBoth(s, press.right, NO_INPUT, PLAYER_RESPAWN_TICKS - 1);
    expect(p2(s).mode).toBe("dead");
    expect(p1(s).x).toBeGreaterThan(0); // player 1 kept playing
    s = step(s, []);
    expect(p2(s)).toMatchObject({ mode: "alive", x: p2(s).startX, y: p2(s).startY, timer: 0 });
    // A dead player ignores its input.
    const d = withPlayer(stateFrom(flat, 1, 2), { mode: "dead", timer: 50 }, 1);
    expect(p2(step(d, [NO_INPUT, press.left])).x).toBe(p2(d).x);
  });

  it("waits while a monk stands on its start, even partly, then reappears", () => {
    let s = withPlayer(stateFrom(flat, 1, 2), { x: 3 * SUB, mode: "dead", timer: 1 }, 1);
    const startX = p2(s).startX;
    s = { ...s, monks: [{ ...newMonk(0, 0), x: startX - 3, y: 0, mode: "trapped", timer: 5 }] };
    const blocked = step(s, []);
    expect(p2(blocked)).toMatchObject({ mode: "dead", x: 3 * SUB });
    const gone = { ...blocked, monks: [] };
    expect(p2(step(gone, [])).mode).toBe("alive");
  });

  it("a player buried in a hole loses a life too", () => {
    let s = stateFrom(["P.....Q.", "########", "########"], 1, 2);
    s = withPlayer(s, { x: 6 * SUB, y: SUB }, 1);
    s = { ...s, holes: [{ cx: 6, cy: 1, age: HOLE_LIFETIME - 1 }] };
    const next = step(s, []);
    expect(p2(next)).toMatchObject({ mode: "dead", lives: START_LIVES - 1 });
    expect(next.status).toBe("playing");
  });

  it("with no life left a player is out for good; the other plays on alone", () => {
    const s = withPlayer(monkOn(stateFrom(flat, 1, 2), 1), { lives: 1 }, 1);
    const next = step(s, []);
    expect(p2(next)).toMatchObject({ mode: "out", lives: 0 });
    expect(next.status).toBe("playing");
    const later = runBoth(
      { ...next, monks: [] },
      press.right,
      press.left,
      PLAYER_RESPAWN_TICKS * 2,
    );
    expect(p2(later)).toEqual(p2(next));
    expect(p1(later).x).toBeGreaterThan(0);
  });

  it("the level is lost once both players are out", () => {
    let s = withPlayer(monkOn(stateFrom(flat, 1, 2), 1), { lives: 1 }, 1);
    s = withPlayer(s, { mode: "out", lives: 0 }, 0);
    expect(step(s, []).status).toBe("dead");
    // Both dead but with lives left: still playing.
    const waiting = withPlayer(monkOn(stateFrom(flat, 1, 2), 1), { mode: "dead", timer: 50 }, 0);
    expect(step(waiting, []).status).toBe("playing");
  });

  it("a monk catches the player it touches only", () => {
    // Both players on the monk's cell are caught on the same tick.
    const s = withPlayer(monkOn(stateFrom(flat, 1, 2), 0), { x: 0 }, 1);
    const next = step(s, []);
    expect(next.players.map((p) => p.mode)).toEqual(["dead", "dead"]);
  });
});

describe("one player", () => {
  it("a death ends the level at once (the session restarts it)", () => {
    const s = monkOn(stateFrom(flat), 0);
    const next = step(s, [NO_INPUT]);
    expect(next.status).toBe("dead");
    expect(p1(next).lives).toBe(START_LIVES - 1);
  });

  it("a level with a player 2 start plays the same with one player as without the start", () => {
    const withQ = createState(levelFrom(["P..$..Q.", "....E...", "########"].map((r) => r)), 4);
    const noQ = createState(levelFrom(["P..$....", "....E...", "########"]), 4);
    expect(withQ).toEqual(noQ);
  });
});
