import { describe, expect, it } from "vitest";
import { modeFor, playerStatusText, statusMessage } from "../../src/game/hud";
import { PLAY_MODES, playerCount } from "../../src/game/session";
import { translate } from "../../src/i18n";
import { START_LIVES, SUB } from "../../src/sim/rules";
import type { GameState } from "../../src/sim/state";
import { levelFrom, stateFrom, withPlayer } from "../sim/helpers";

const twoRows = ["P......Q", "########"];

describe("modeFor and playerCount", () => {
  it("plays the picked mode only when the level has a player 2 start", () => {
    for (const mode of PLAY_MODES) {
      expect(modeFor(levelFrom(twoRows), mode)).toBe(mode);
      expect(modeFor(levelFrom(["P.......", "########"]), mode)).toBe("solo");
    }
  });

  it("solo is one player; co-op and versus are two", () => {
    expect(PLAY_MODES.map(playerCount)).toEqual([1, 2, 2]);
  });
});

describe("statusMessage", () => {
  // Player 1 on the exit at x = 2, player 2 at x = 6 (or on the exit too), no gold left.
  const exitRows = ["P.E...Q.", "########"];
  function wonBy(onExit: readonly number[]): GameState {
    let s: GameState = { ...stateFrom(exitRows, 1, 2), goldLeft: 0, status: "won" };
    s = withPlayer(s, { x: onExit.includes(0) ? 2 * SUB : 0 }, 0);
    return withPlayer(s, { x: onExit.includes(1) ? 2 * SUB : 6 * SUB }, 1);
  }

  it("shows each mode's controls while playing", () => {
    const s = stateFrom(exitRows, 1, 2);
    expect(statusMessage(stateFrom(exitRows), "solo")).toBe("controls");
    expect(statusMessage(s, "coop")).toBe("controls2");
    expect(statusMessage(s, "versus")).toBe("controlsVersus");
  });

  it("a lost level: caught alone, both out with two", () => {
    const dead = { ...stateFrom(exitRows, 1, 2), status: "dead" as const };
    expect(statusMessage({ ...stateFrom(exitRows), status: "dead" }, "solo")).toBe("caught");
    expect(statusMessage(dead, "coop")).toBe("allOut");
    expect(statusMessage(dead, "versus")).toBe("allOut");
  });

  it("a won level: complete alone or in co-op, whoever got out", () => {
    expect(statusMessage(wonBy([1]), "coop")).toBe("won");
    expect(statusMessage({ ...stateFrom(exitRows), status: "won" }, "solo")).toBe("won");
  });

  it("in versus, names the winner, or calls a draw when both got out together", () => {
    expect(statusMessage(wonBy([0]), "versus")).toBe("versusWon1");
    expect(statusMessage(wonBy([1]), "versus")).toBe("versusWon2");
    expect(statusMessage(wonBy([0, 1]), "versus")).toBe("versusDraw");
    expect(translate("en", "versusWon2")).toContain("Player 2");
    expect(translate("fr", "versusWon2")).toContain("joueur 2");
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
