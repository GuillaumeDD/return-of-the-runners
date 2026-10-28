import { describe, expect, it } from "vitest";
import { playerStatusText, playersFor } from "../../src/game/hud";
import { START_LIVES } from "../../src/sim/rules";
import { levelFrom, stateFrom, withPlayer } from "../sim/helpers";

const twoRows = ["P......Q", "########"];

describe("playersFor", () => {
  it("plays two only when picked and the level has a player 2 start", () => {
    expect(playersFor(levelFrom(twoRows), 2)).toBe(2);
    expect(playersFor(levelFrom(twoRows), 1)).toBe(1);
    expect(playersFor(levelFrom(["P.......", "########"]), 2)).toBe(1);
  });
});

describe("playerStatusText", () => {
  it("is empty for one player", () => {
    expect(playerStatusText("en", stateFrom(twoRows))).toBe("");
  });

  it("shows each player's lives and gold, in both languages", () => {
    const s = withPlayer(stateFrom(twoRows, 1, 2), { gold: 3, lives: 2 }, 1);
    expect(playerStatusText("en", s)).toBe(
      `Player 1: lives ${String(START_LIVES)}, gold 0 · Player 2: lives 2, gold 3`,
    );
    expect(playerStatusText("fr", s)).toBe(
      `Joueur 1 : vies ${String(START_LIVES)}, or 0 · Joueur 2 : vies 2, or 3`,
    );
  });

  it("says when a player is out", () => {
    const s = withPlayer(stateFrom(twoRows, 1, 2), { mode: "out", lives: 0 }, 0);
    expect(playerStatusText("en", s)).toBe(
      `Player 1: out · Player 2: lives ${String(START_LIVES)}, gold 0`,
    );
  });
});
