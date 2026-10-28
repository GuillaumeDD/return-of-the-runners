import { translate, type Locale, type MessageKey } from "../i18n";
import type { Level } from "../level/format";
import { maxPlayers, type GameState, type PlayerCount } from "../sim/state";

/**
 * The player count a level is played with: the count the players picked, when the
 * level allows it (two players need a player 2 start).
 */
export function playersFor(level: Level, picked: PlayerCount): PlayerCount {
  return picked === 2 && maxPlayers(level) === 2 ? 2 : 1;
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
