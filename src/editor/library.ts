import { translate, type Locale, type MessageKey } from "../i18n";
import { levelErrorMessage } from "../i18n/level-errors";
import type { LevelErrorCode } from "../level/format";
import type { StorageProblem } from "../storage/levels";
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

/**
 * What the status line says when it is not just "saved" / "not saved yet": storage
 * problems (kept until the list is read again), why Save, Export or Import refused a
 * level, or that an export started (both cleared on the next edit).
 */
export type Notice =
  | { readonly kind: "storage"; readonly problems: readonly StorageProblem[] }
  | {
      readonly kind: "level";
      readonly prefix: MessageKey | null;
      readonly codes: readonly LevelErrorCode[];
    }
  | { readonly kind: "info"; readonly key: MessageKey };

const PROBLEM_MESSAGE: Readonly<Record<StorageProblem, MessageKey>> = {
  "corrupt-document": "storageCorruptDocument",
  "corrupt-entry": "storageCorruptEntry",
  quota: "storageQuota",
  "not-found": "storageNotFound",
};

/**
 * The status line, translated when shown (so a pending notice follows a language
 * switch). An info notice is followed by the save status, so "exported" never hides
 * "not saved yet".
 */
export function statusText(
  locale: Locale,
  notice: Notice | null,
  current: EditorState,
  tracking: Tracking,
): string {
  const status = translate(locale, statusKey(current, tracking));
  switch (notice?.kind) {
    case undefined:
      return status;
    case "storage":
      return notice.problems.map((p) => translate(locale, PROBLEM_MESSAGE[p])).join(" ");
    case "level":
      return [
        ...(notice.prefix === null ? [] : [translate(locale, notice.prefix)]),
        ...notice.codes.map((c) => levelErrorMessage(locale, c)),
      ].join(" ");
    case "info":
      return `${translate(locale, notice.key)} ${status}`;
  }
}

/** Whether a notice is a problem (shown in the problem color). */
export function isProblem(notice: Notice | null): boolean {
  return notice !== null && notice.kind !== "info";
}

/** After an edit: the save status replaces a refusal or an info notice. */
export function afterEdit(notice: Notice | null): Notice | null {
  return notice?.kind === "storage" ? notice : null;
}
