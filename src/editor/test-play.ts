import type { Level, LevelError, LevelErrorCode } from "../level/format";
import { toLevel, type EditorState } from "./model";

export type TestStart =
  | { readonly ok: true; readonly level: Level }
  | { readonly ok: false; readonly errors: readonly LevelErrorCode[] };

/**
 * The validator's error codes for the level being edited (each once), or null when it
 * can be tested. Cheaper than `startTest`: it builds no game.
 */
export function testErrors(editor: EditorState): readonly LevelErrorCode[] | null {
  const result = toLevel(editor);
  return result.ok ? null : codesOf(result.errors);
}

function codesOf(errors: readonly LevelError[]): LevelErrorCode[] {
  return [...new Set(errors.map((e) => e.code))];
}

/**
 * The level to test, or the validator's error codes (each once, in the validator's
 * order). The editor state is not touched: coming back from the test finds it as it
 * was, undo history included. The play screen builds the game, with one or two players.
 */
export function startTest(editor: EditorState): TestStart {
  const result = toLevel(editor);
  if (!result.ok) return { ok: false, errors: codesOf(result.errors) };
  return { ok: true, level: result.level };
}
