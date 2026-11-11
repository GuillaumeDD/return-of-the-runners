import type { PlayMode } from "../game/session";
import type { MessageKey } from "../i18n";
import firstSteps from "./first-steps.json?raw";
import mossTrail from "./solo-01-moss-trail.json?raw";
import monkTraps from "./solo-02-monk-traps.json?raw";
import trickyTemple from "./solo-03-tricky-temple.json?raw";
import portals from "./solo-04-portals.json?raw";
import frostKeys from "./solo-05-frost-keys.json?raw";
import digSite from "./solo-06-dig-site.json?raw";
import fireworks from "./solo-07-fireworks.json?raw";
import glowingMist from "./solo-08-glowing-mist.json?raw";
import betterTogether from "./duo-01-better-together.json?raw";
import decoy from "./duo-02-decoy.json?raw";
import factoryDuel from "./duo-03-factory-duel.json?raw";
import goldRush from "./duo-04-gold-rush.json?raw";

/**
 * One level of a bundled pack: an `id` stable within its pack (progress is remembered
 * by it, so it never changes once shipped), its title in every language (the level
 * file's own `name` is the English one), the level document itself and, in the
 * two-player pack, the mode it is meant for (the players can still switch).
 */
export interface PackEntry {
  readonly id: string;
  readonly title: MessageKey;
  readonly text: string;
  readonly mode?: "coop" | "versus";
}

/**
 * A bundled pack (B-051): the levels for one player, or those for two on one keyboard.
 * `players` decides which modes its games offer (`packModes`).
 */
export interface Pack {
  readonly id: "solo" | "duo";
  readonly title: MessageKey;
  readonly players: 1 | 2;
  readonly levels: readonly PackEntry[];
}

/** The packs of the play screen, each with its levels in the order they are played. */
export const PACKS: readonly Pack[] = [
  {
    id: "solo",
    title: "packSolo",
    players: 1,
    levels: [
      { id: "moss-trail", title: "levelMossTrail", text: mossTrail },
      { id: "monk-traps", title: "levelMonkTraps", text: monkTraps },
      { id: "tricky-temple", title: "levelTrickyTemple", text: trickyTemple },
      { id: "portals", title: "levelPortals", text: portals },
      { id: "frost-keys", title: "levelFrostKeys", text: frostKeys },
      { id: "dig-site", title: "levelDigSite", text: digSite },
      { id: "fireworks", title: "levelFireworks", text: fireworks },
      { id: "glowing-mist", title: "levelGlowingMist", text: glowingMist },
      // The default level, last: every step 3 feature at once.
      { id: "first-steps", title: "levelFirstSteps", text: firstSteps },
    ],
  },
  {
    id: "duo",
    title: "packDuo",
    players: 2,
    levels: [
      { id: "better-together", title: "levelBetterTogether", text: betterTogether, mode: "coop" },
      { id: "decoy", title: "levelDecoy", text: decoy, mode: "coop" },
      { id: "factory-duel", title: "levelFactoryDuel", text: factoryDuel, mode: "versus" },
      { id: "gold-rush", title: "levelGoldRush", text: goldRush, mode: "versus" },
    ],
  },
];

/** The modes a game of the pack offers: alone, or the two-player modes. */
export function packModes(pack: Pick<Pack, "players">): readonly PlayMode[] {
  return pack.players === 1 ? ["solo"] : ["coop", "versus"];
}

/**
 * The mode a level of the pack starts in: alone in the one-player pack; in the
 * two-player pack, the mode the level is meant for, else the two-player mode picked
 * last, else co-op.
 */
export function packStartMode(
  pack: Pick<Pack, "players">,
  entry: Pick<PackEntry, "mode">,
  picked: PlayMode,
): PlayMode {
  if (pack.players === 1) return "solo";
  return entry.mode ?? (picked === "solo" ? "coop" : picked);
}

/** Where progress remembers a level: its pack and its id. */
export function progressKey(pack: Pick<Pack, "id">, entry: Pick<PackEntry, "id">): string {
  return `${pack.id}/${entry.id}`;
}

/** The level after `index`; after the last one, the pack starts over. */
export function nextIndex(index: number, count: number): number {
  return (index + 1) % count;
}
