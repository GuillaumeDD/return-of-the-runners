import type { StorageLike } from "./levels";

/**
 * The player's progress through the bundled pack (B-051), in this browser only: the
 * level being played and the levels won so far, by pack id. Losing it costs nothing
 * but the ticks in the level list, so a broken document simply reads as no progress.
 */
export interface Progress {
  readonly current: string | null;
  readonly done: readonly string[];
}

export const PROGRESS_KEY = "rotr.pack.v1";
export const PROGRESS_FORMAT_ID = "return-of-the-runners/progress";
export const PROGRESS_FORMAT_VERSION = 1;
/** Far above what the pack needs; a longer value was not written by this game. */
const MAX_DOCUMENT_LENGTH = 16 * 1024;

export const NO_PROGRESS: Progress = { current: null, done: [] };

/**
 * The stored progress, untrusted: only the ids of `known` levels are kept, each once,
 * in pack order. Storage errors and broken documents give no progress.
 */
export function readProgress(store: StorageLike, known: readonly string[]): Progress {
  let raw: string | null;
  try {
    raw = store.getItem(PROGRESS_KEY);
  } catch {
    return NO_PROGRESS;
  }
  if (raw === null || raw.length > MAX_DOCUMENT_LENGTH) return NO_PROGRESS;
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return NO_PROGRESS;
  }
  if (typeof doc !== "object" || doc === null) return NO_PROGRESS;
  const fields = doc as Record<string, unknown>;
  if (fields.format !== PROGRESS_FORMAT_ID || fields.version !== PROGRESS_FORMAT_VERSION) {
    return NO_PROGRESS;
  }
  const current =
    typeof fields.current === "string" && known.includes(fields.current) ? fields.current : null;
  const listed = Array.isArray(fields.done) ? (fields.done as unknown[]) : [];
  const done = known.filter((id) => listed.includes(id));
  return { current, done };
}

/** Remembers `progress`; false when the browser refused (storage full or disabled). */
export function saveProgress(store: StorageLike, progress: Progress): boolean {
  const doc = {
    format: PROGRESS_FORMAT_ID,
    version: PROGRESS_FORMAT_VERSION,
    current: progress.current,
    done: progress.done,
  };
  try {
    store.setItem(PROGRESS_KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

/** `progress` with `id` won, kept in pack order (`known`). */
export function markDone(progress: Progress, id: string, known: readonly string[]): Progress {
  const done = known.filter((k) => k === id || progress.done.includes(k));
  return { ...progress, done };
}
