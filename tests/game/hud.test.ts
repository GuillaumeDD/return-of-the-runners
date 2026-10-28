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
      `Player 1: ${String(START_LIVES)} lives, 0 gold · Player 2: 2 lives, 3 gold`,
    );
    expect(playerStatusText("fr", s)).toBe(
      `Joueur 1 : ${String(START_LIVES)} vies, 0 or · Joueur 2 : 2 vies, 3 or`,
    );
  });

  it("says when a player is out", () => {
    const s = withPlayer(stateFrom(twoRows, 1, 2), { mode: "out", lives: 0 }, 0);
    expect(playerStatusText("en", s)).toBe(
      `Player 1: out · Player 2: ${String(START_LIVES)} lives, 0 gold`,
    );
  });
});
