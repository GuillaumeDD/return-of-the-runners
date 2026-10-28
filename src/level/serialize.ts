import { LEVEL_FORMAT_ID, LEVEL_FORMAT_VERSION, type LevelDraft } from "./format";

/**
 * The v2 document of a level (or a draft), fields in their canonical order. `teleports`
 * is written only when the level has some, so a level without teleporters has the same
 * fields as in v1.
 */
export function levelDocument(level: LevelDraft): Record<string, unknown> {
  return {
    format: LEVEL_FORMAT_ID,
    version: LEVEL_FORMAT_VERSION,
    name: level.name,
    width: level.width,
    height: level.height,
    grid: level.grid,
    ...(level.teleports.length > 0 ? { teleports: level.teleports } : {}),
  };
}

/** A draft of a level: the same data, without the guarantee that it can be played. */
export function draftOf(level: LevelDraft): LevelDraft {
  return {
    name: level.name,
    width: level.width,
    height: level.height,
    grid: level.grid,
    teleports: level.teleports,
  };
}
