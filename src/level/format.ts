/**
 * Level format v2: a human-readable JSON document with a text grid, plus the links of
 * its teleporters. See docs/ARCHITECTURE.md § Level format.
 */

export const LEVEL_FORMAT_ID = "return-of-the-runners/level";
export const LEVEL_FORMAT_VERSION = 2;

/** The tiles of the original 1982 game, the ones the editor palette offers so far. */
export const TILE_BASE = {
  empty: ".",
  brick: "#",
  bedrock: "@",
  ladder: "H",
  bar: "-",
  gold: "$",
  exit: "E",
  runnerStart: "P",
  monkStart: "M",
} as const;

/**
 * Every tile of version 2. The tiles added in v2 are reserved by the format first
 * (B-019); each gets its behavior, its drawing and its place in the editor palette in
 * a later step 3 item. Until then the game does not draw them, and they are neither
 * solid nor climbable.
 */
export const TILE = {
  ...TILE_BASE,
  player2Start: "Q",
  trapdoor: "%",
  gooeyTurf: "~",
  hiddenLadder: "h",
  monkRespawn: "R",
  alcove: "n",
  teleportEntrance: "T",
  teleportExit: "t",
  keyRed: "a",
  keyGreen: "b",
  keyBlue: "c",
  doorRed: "A",
  doorGreen: "B",
  doorBlue: "C",
  jackhammer: "j",
  pickaxe: "k",
  smallBomb: "o",
  bigBomb: "O",
  snare: "s",
  gasSpray: "g",
  gooBucket: "u",
} as const;

export type TileChar = (typeof TILE)[keyof typeof TILE];

export const TILE_CHARS: ReadonlySet<string> = new Set(Object.values(TILE));

/**
 * A one-way teleporter link, `[fromX, fromY, toX, toY]` in cells: from an entrance
 * (`T`) to an exit (`t`).
 */
export type Teleport = readonly [number, number, number, number];

export const LIMITS = {
  /** Raw input size, in UTF-8 bytes. */
  maxInputBytes: 64 * 1024,
  minWidth: 8,
  maxWidth: 64,
  minHeight: 8,
  maxHeight: 48,
  maxNameLength: 64,
  maxMonks: 16,
} as const;

export interface Level {
  readonly version: typeof LEVEL_FORMAT_VERSION;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** `height` rows of exactly `width` tile characters, top row first. */
  readonly grid: readonly string[];
  /** Teleporter links, in document order; empty when the level has none. */
  readonly teleports: readonly Teleport[];
}

/**
 * A level that may not be playable yet: the shape of a level (size, tiles, name) without
 * the game rules (one runner start, gold, an exit, the monk cap). What "My levels" keeps,
 * so a level can be saved half-built. It has no `version`, so it cannot be passed where
 * a `Level` is expected: playing it takes a full `parseLevel` first.
 */
export interface LevelDraft {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly grid: readonly string[];
  readonly teleports: readonly Teleport[];
}

export type LevelErrorCode =
  | "too-large"
  | "not-json"
  | "not-object"
  | "wrong-format"
  | "unsupported-version"
  | "missing-field"
  | "unknown-field"
  | "invalid-name"
  | "invalid-dimension"
  | "invalid-grid"
  | "row-count"
  | "row-length"
  | "unknown-tile"
  | "runner-count"
  | "no-gold"
  | "no-exit"
  | "too-many-monks"
  | "player2-count"
  /** `teleports` is not an array of `[fromX, fromY, toX, toY]` integer links. */
  | "invalid-teleports"
  | "teleport-out-of-grid"
  | "teleport-not-entrance"
  | "teleport-not-exit"
  /** An entrance with more than one link. */
  | "teleport-duplicate"
  /** An entrance with no link. */
  | "teleport-unlinked"
  /** Import only: the file could not be read (moved, deleted, no permission). */
  | "unreadable-file"
  /** Share links only: the payload is over its cap, not base64url, or not DEFLATE data. */
  | "too-long"
  | "not-base64"
  | "not-deflate";

export interface LevelError {
  readonly code: LevelErrorCode;
  /** English, developer-facing detail. UI messages are translated from `code`. */
  readonly detail: string;
}

export type ParseResult =
  | { readonly ok: true; readonly level: Level }
  | { readonly ok: false; readonly errors: readonly LevelError[] };

/**
 * Splits a string into code points. Intentional: tiles are single ASCII characters, and
 * the name limit counts code points, so grapheme segmentation is not needed here.
 */
export function codePoints(s: string): string[] {
  return Array.from(s);
}
