import type { MessageKey } from "../i18n";
import { TILE, type TileChar } from "../level/format";

/** The palette, in order: number key N picks entry N, and 0 picks entry 10. */
export const PALETTE: readonly { readonly tile: TileChar; readonly name: MessageKey }[] = [
  { tile: TILE.brick, name: "tileBrick" },
  { tile: TILE.bedrock, name: "tileBedrock" },
  { tile: TILE.ladder, name: "tileLadder" },
  { tile: TILE.bar, name: "tileBar" },
  { tile: TILE.gold, name: "tileGold" },
  { tile: TILE.exit, name: "tileExit" },
  { tile: TILE.runnerStart, name: "tileRunner" },
  { tile: TILE.monkStart, name: "tileMonk" },
  { tile: TILE.empty, name: "tileEmpty" },
  { tile: TILE.player2Start, name: "tileRunner2" },
  { tile: TILE.trapdoor, name: "tileTrapdoor" },
  { tile: TILE.gooeyTurf, name: "tileGooeyTurf" },
  { tile: TILE.hiddenLadder, name: "tileHiddenLadder" },
  { tile: TILE.alcove, name: "tileAlcove" },
  { tile: TILE.monkRespawn, name: "tileMonkRespawn" },
  { tile: TILE.teleportEntrance, name: "tileTeleportEntrance" },
  { tile: TILE.teleportExit, name: "tileTeleportExit" },
  { tile: TILE.keyRed, name: "tileKeyRed" },
  { tile: TILE.doorRed, name: "tileDoorRed" },
  { tile: TILE.keyGreen, name: "tileKeyGreen" },
  { tile: TILE.doorGreen, name: "tileDoorGreen" },
  { tile: TILE.keyBlue, name: "tileKeyBlue" },
  { tile: TILE.doorBlue, name: "tileDoorBlue" },
  { tile: TILE.jackhammer, name: "tileJackhammer" },
  { tile: TILE.pickaxe, name: "tilePickaxe" },
  { tile: TILE.smallBomb, name: "tileSmallBomb" },
  { tile: TILE.bigBomb, name: "tileBigBomb" },
];

/**
 * The palette tile for a key, by `KeyboardEvent.code` (physical key), so the top row
 * works without Shift on AZERTY keyboards. Digit or numpad 1–9 and 0; anything else:
 * null.
 */
export function tileForKey(code: string): TileChar | null {
  const match = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (match === null) return null;
  const n = Number(match[1]);
  return PALETTE[n === 0 ? 9 : n - 1]?.tile ?? null;
}

export type Shortcut = "undo" | "redo";

export interface ShortcutKey {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

/**
 * Ctrl+Z undoes; Ctrl+Y and Ctrl+Shift+Z redo (Cmd on a Mac). By `KeyboardEvent.key`,
 * the letter printed on the key, as in every other application.
 */
export function shortcutFor(e: ShortcutKey): Shortcut | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  const key = e.key.toLowerCase();
  if (key === "z") return e.shiftKey ? "redo" : "undo";
  if (key === "y" && !e.shiftKey) return "redo";
  return null;
}
