import type { Locale, MessageKey } from "../i18n";
import { relabelName } from "./fields";
import { rename, sameContent, type EditorState } from "./model";

/**
 * The decisions behind "My levels", kept pure so they are tested without a browser
 * (`library-view.ts` only wires them to the DOM).
 */

/** The level in the editor: which saved level it is (null: never saved) and as saved. */
export interface Tracking {
  readonly id: number | null;
  readonly saved: EditorState;
}

/** Changes since the level was last saved or opened (a new level: since it was created). */
export function isDirty(current: EditorState, tracking: Tracking): boolean {
  return !sameContent(current, tracking.saved);
}

/** "Saved in this browser" only for a saved level with no change since. */
export function statusKey(current: EditorState, tracking: Tracking): MessageKey {
  return tracking.id === null || isDirty(current, tracking) ? "statusUnsaved" : "statusSaved";
}

/**
 * After a language switch, the editor's default name follows the language. For a level
 * never saved that is not a change; for a saved level it is one (the stored name is
 * still the old one), so the baseline keeps its name.
 */
export function relabelTracking(tracking: Tracking, from: Locale, to: Locale): Tracking {
  if (tracking.id !== null) return tracking;
  return { ...tracking, saved: rename(tracking.saved, relabelName(tracking.saved.name, from, to)) };
}
