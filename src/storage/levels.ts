import type { LevelDraft } from "../level/format";
import { parseLevel } from "../level/parse";
import { draftOf, levelDocument } from "../level/serialize";

/**
 * "My levels": the levels kept in the browser, under one versioned key. Everything read
 * back is untrusted (another tab, an older version, a hand edit): the document is
 * checked and each level goes through `parseLevel`, so a broken entry is skipped and
 * reported, never a crash. Levels are kept as drafts (`LevelDraft`): a level can be
 * saved before it is playable; the game rules are checked when it is tested or played. Ids come from a counter in the document, never from the
 * clock or `Math.random`.
 */

/** The part of `Storage` this module uses, so tests can pass an in-memory fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const STORAGE_KEY = "rotr.levels.v1";
/** Where a corrupt document is kept when a save replaces it, so it can still be rescued. */
export const BACKUP_KEY = "rotr.levels.v1.corrupt";
export const STORE_FORMAT_ID = "return-of-the-runners/my-levels";
export const STORE_FORMAT_VERSION = 1;
/** Above browsers' usual 5 MB quota: a longer value was not written by this game. */
const MAX_DOCUMENT_LENGTH = 5 * 1024 * 1024;

export interface SavedLevel {
  readonly id: number;
  readonly level: LevelDraft;
}

/**
 * `corrupt-document`: the whole document is unreadable (not JSON, wrong format or
 * version); `corrupt-entry`: one level is skipped; `quota`: the browser refused the
 * write (storage full or disabled); `not-found`: no level with that id (deleted in
 * another tab, say).
 */
export type StorageProblem = "corrupt-document" | "corrupt-entry" | "quota" | "not-found";

export interface LevelList {
  /** Last saved first. */
  readonly levels: readonly SavedLevel[];
  readonly problems: readonly StorageProblem[];
}

export type WriteResult =
  | { readonly ok: true; readonly id: number }
  | { readonly ok: false; readonly problem: StorageProblem };

interface Contents {
  readonly nextId: number;
  readonly levels: readonly SavedLevel[];
  readonly problems: readonly StorageProblem[];
  /** The document could not be read: the raw text, kept aside on the next save. */
  readonly corrupt: string | null;
  /** Entries skipped as damaged, kept as they are in every rewrite (never erased). */
  readonly skipped: readonly unknown[];
  /** False when the storage itself refused the read: nothing may be written then. */
  readonly readable: boolean;
}

/** Ids stay far below `Number.MAX_SAFE_INTEGER`, so `id + 1` is always exact. */
const MAX_ID = 2 ** 31 - 1;

export function listLevels(store: StorageLike): LevelList {
  const { levels, problems } = read(store);
  return { levels, problems };
}

/** The level saved under `id` as it is stored now (another tab may have changed it). */
export function getLevel(store: StorageLike, id: number): SavedLevel | null {
  return read(store).levels.find((l) => l.id === id) ?? null;
}

/**
 * Saves a level, as a new one (no id) or over the level with that id, and moves it
 * first in the list. Returns its id. A corrupt document is replaced, after a copy of it
 * is kept under `BACKUP_KEY` when the storage has room for it (an unreadable document
 * must not block every save).
 */
export function saveLevel(store: StorageLike, draft: LevelDraft, id?: number): WriteResult {
  const contents = read(store);
  if (!contents.readable) return quota();
  const level = draftOf(draft);
  if (id !== undefined && !contents.levels.some((l) => l.id === id)) {
    return { ok: false, problem: "not-found" };
  }
  const savedId = id ?? contents.nextId;
  const levels = [{ id: savedId, level }, ...contents.levels.filter((l) => l.id !== savedId)];
  if (contents.corrupt !== null) write(store, BACKUP_KEY, contents.corrupt);
  const next = { ...contents, nextId: Math.max(contents.nextId, savedId + 1), levels };
  return writeContents(store, next) ? { ok: true, id: savedId } : quota();
}

export function deleteLevel(store: StorageLike, id: number): WriteResult {
  const contents = read(store);
  if (!contents.readable) return quota();
  if (!contents.levels.some((l) => l.id === id)) return { ok: false, problem: "not-found" };
  const levels = contents.levels.filter((l) => l.id !== id);
  return writeContents(store, { ...contents, levels }) ? { ok: true, id } : quota();
}

function read(store: StorageLike): Contents {
  const empty = (problem: StorageProblem | null, corrupt: string | null): Contents => ({
    nextId: 1,
    levels: [],
    problems: problem === null ? [] : [problem],
    corrupt,
    skipped: [],
    readable: true,
  });
  let text: string | null;
  try {
    text = store.getItem(STORAGE_KEY);
  } catch {
    // Storage disabled (privacy settings): saving now would erase what is stored.
    return { ...empty("quota", null), readable: false };
  }
  if (text === null) return empty(null, null);
  if (text.length > MAX_DOCUMENT_LENGTH) return empty("corrupt-document", text);
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return empty("corrupt-document", text);
  }
  if (
    !isObject(doc) ||
    doc.format !== STORE_FORMAT_ID ||
    doc.version !== STORE_FORMAT_VERSION ||
    !Array.isArray(doc.levels)
  ) {
    return empty("corrupt-document", text);
  }

  const levels: SavedLevel[] = [];
  const skipped: unknown[] = [];
  const used = new Set<number>();
  for (const entry of doc.levels as unknown[]) {
    const saved = isObject(entry) ? readEntry(entry, used) : null;
    if (saved === null) skipped.push(entry);
    else levels.push(saved);
    // Even a damaged entry's id stays taken, so a new level never shares it.
    if (isObject(entry) && isId(entry.id)) used.add(entry.id);
  }
  return {
    nextId: freeId(doc.nextId, used),
    levels,
    problems: skipped.length > 0 ? ["corrupt-entry"] : [],
    corrupt: null,
    skipped,
    readable: true,
  };
}

/** The stored counter, moved past every used id; the lowest free id if that overflows. */
function freeId(counter: unknown, used: ReadonlySet<number>): number {
  const next = Math.max(isId(counter) ? counter : 1, ...[...used].map((id) => id + 1));
  if (next <= MAX_ID) return next;
  let id = 1;
  while (used.has(id)) id++;
  return id;
}

function readEntry(entry: Record<string, unknown>, seen: ReadonlySet<number>): SavedLevel | null {
  if (!isId(entry.id) || seen.has(entry.id)) return null;
  const level = parseDraft(entry.level ?? null);
  return level === null ? null : { id: entry.id, level };
}

/** A stored level document, checked for its shape only (see `LevelDraft`). */
function parseDraft(doc: unknown): LevelDraft | null {
  const parsed = parseLevel(JSON.stringify(doc), { gameRules: false });
  return parsed.ok ? draftOf(parsed.level) : null;
}

function writeContents(store: StorageLike, contents: Contents): boolean {
  const doc = {
    format: STORE_FORMAT_ID,
    version: STORE_FORMAT_VERSION,
    nextId: contents.nextId,
    levels: [
      ...contents.levels.map(({ id, level }) => ({ id, level: levelDocument(level) })),
      ...contents.skipped,
    ],
  };
  return write(store, STORAGE_KEY, JSON.stringify(doc));
}

/** False when the browser refuses the write (`QuotaExceededError`, storage disabled). */
function write(store: StorageLike, key: string, value: string): boolean {
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function quota(): WriteResult {
  return { ok: false, problem: "quota" };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isId(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_ID;
}
