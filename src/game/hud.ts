import { translate, type Locale, type MessageKey } from "../i18n";
import type { Level } from "../level/format";
import { maxPlayers, type GameState } from "../sim/state";
import { playersAtExit } from "../sim/step";
import type { PlayMode } from "./session";

/**
 * The mode a level is played in: the mode the players picked, when the level allows it
 * (two players need a player 2 start); otherwise alone.
 */
export function modeFor(level: Level, picked: PlayMode): PlayMode {
  return maxPlayers(level) === 2 ? picked : "solo";
}

/**
 * The message under a game: the controls while playing, then how the level ended. In
 * versus, the end names the winner, or says it is a draw when both players reached an
 * exit on the same tick.
 */
export function statusMessage(
  state: Pick<GameState, "status" | "tiles" | "goldLeft" | "players">,
  mode: PlayMode,
): MessageKey {
  switch (state.status) {
    case "playing":
      return mode === "solo" ? "controls" : mode === "coop" ? "controls2" : "controlsVersus";
    case "dead":
      return mode === "solo" ? "caught" : "allOut";
    case "won": {
      if (mode !== "versus") return "won";
      const winners = playersAtExit(state);
      if (winners.length > 1) return "versusDraw";
      return winners[0] === 1 ? "versusWon2" : "versusWon1";
    }
  }
}

const PLAYER_NAME: readonly MessageKey[] = ["playerName1", "playerName2"];

/**
 * The status line under a two-player game: each player's lives and gold, or that the
 * player is out. Empty for one player (lives and scores for one player come with level
 * packs, in step 4).
 */
export function playerStatusText(locale: Locale, state: Pick<GameState, "players">): string {
  if (state.players.length < 2) return "";
  return state.players
    .map((p, i) => {
      const player = translate(locale, PLAYER_NAME[i] ?? "playerName1");
      const line =
        p.mode === "out"
          ? translate(locale, "hudOut")
          : translate(locale, "hudPlayer")
              .replace("{lives}", String(p.lives))
              .replace("{gold}", String(p.gold));
      return line.replace("{player}", player);
    })
    .join(" · ");
}
