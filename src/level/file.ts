import { LIMITS, type Level, type ParseResult } from "./format";
import { parseLevel } from "./parse";
import { levelDocument } from "./serialize";

/** The extension of exported levels: still plain JSON, named so it is recognizable. */
export const LEVEL_FILE_EXTENSION = ".rotr.json";
const MAX_FILE_STEM = 60;

/**
 * The exported file of a level: its exact v2 document, pretty-printed (two spaces, one
 * grid row and one teleporter link per line, a final newline) so it reads well in a
 * text editor and diffs cleanly.
 */
export function exportLevel(level: Level): { readonly fileName: string; readonly text: string } {
  // Pretty-printing puts each number of a link on its own line: join them back. Only
  // links are arrays of numbers, and a raw line break is never inside a JSON string, so
  // a name that looks like a link is left alone.
  const text = JSON.stringify(levelDocument(level), null, 2).replace(
    /\[\n *(-?\d+),\n *(-?\d+),\n *(-?\d+),\n *(-?\d+)\n *\]/g,
    "[$1,$2,$3,$4]",
  );
  return { fileName: fileName(level.name), text: `${text}\n` };
}

/**
 * A file name from a level name, in plain ASCII: accents are dropped ("é" → "e"), and
 * anything else but letters, digits, spaces, `-` and `_` (path separators, `:`, `*`,
 * other scripts…) becomes `-`. Headless Chromium falls back to "download" for a
 * non-ASCII `download` name, and some file systems mangle them. Never empty, never a
 * hidden file (a `.` cannot survive), never a Windows device name (`CON`, `NUL`…), at
 * most 60 characters before the extension.
 */
export function fileName(name: string): string {
  const stem = name
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^A-Za-z0-9 _-]+/g, "-")
    .slice(0, MAX_FILE_STEM)
    .replace(/^[ -]+|[ -]+$/g, "");
  if (stem === "") return `level${LEVEL_FILE_EXTENSION}`;
  // Device names that Windows refuses as a file name, whatever the extension.
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem);
  return `${reserved ? `${stem}-level` : stem}${LEVEL_FILE_EXTENSION}`;
}

/** The part of `File` an import needs, so tests can pass a fake. */
export interface LevelFile {
  readonly size: number;
  text(): Promise<string>;
}

/**
 * Reads an imported file: over the level size cap it is rejected from its size alone,
 * before any byte is read; otherwise it goes through the full validator, game rules
 * included (an exported level is always playable). Never rejects.
 */
export async function importLevel(file: LevelFile): Promise<ParseResult> {
  if (file.size > LIMITS.maxInputBytes) {
    return {
      ok: false,
      errors: [{ code: "too-large", detail: `file is ${String(file.size)} bytes` }],
    };
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    return {
      ok: false,
      errors: [{ code: "unreadable-file", detail: "the file could not be read" }],
    };
  }
  return parseLevel(text);
}
