import { translate, type Locale, type MessageKey } from "../i18n";
import { levelErrorMessage } from "../i18n/level-errors";
import type { LevelErrorCode } from "../level/format";
import {
  STORAGE_KEY,
  deleteLevel,
  getLevel,
  listLevels,
  saveLevel,
  type SavedLevel,
  type StorageLike,
  type StorageProblem,
} from "../storage/levels";
import { isDirty, relabelTracking, statusKey, type Tracking } from "./library";
import { editorFrom, newEditor, toDraft } from "./model";
import type { EditorView } from "./view";

/** "My levels" elements, from index.html. */
export interface LibraryElements {
  readonly save: HTMLButtonElement;
  readonly newLevel: HTMLButtonElement;
  /** One line: saved, not saved yet, or a storage problem. */
  readonly status: HTMLElement;
  readonly title: HTMLElement;
  readonly list: HTMLUListElement;
  readonly empty: HTMLElement;
}

export interface LibraryView {
  readonly setLocale: (locale: Locale) => void;
  /** The edited level changed: refreshes "not saved yet". */
  readonly changed: () => void;
}

const PROBLEM_MESSAGE: Readonly<Record<StorageProblem, MessageKey>> = {
  "corrupt-document": "storageCorruptDocument",
  "corrupt-entry": "storageCorruptEntry",
  quota: "storageQuota",
  "not-found": "storageNotFound",
};

/**
 * "My levels": save the edited level in the browser, start a new one, open or delete a
 * saved one. Leaving unsaved changes (New, Open) and deleting take a second click on
 * the same button. Level names are shown with `textContent` (they are untrusted).
 */
export function createLibraryView(
  els: LibraryElements,
  store: StorageLike,
  editor: EditorView,
  initialLocale: Locale,
): LibraryView {
  let locale = initialLocale;
  /** Which saved level is in the editor, and as it was saved. */
  let tracking: Tracking = { id: null, saved: editor.current() };
  /**
   * The status line, when it is not "saved" / "not saved yet": storage problems (kept
   * until the next list refresh) or why Save refused the level (cleared on the next edit).
   */
  let notice:
    | { readonly kind: "storage"; readonly problems: readonly StorageProblem[] }
    | { readonly kind: "level"; readonly codes: readonly LevelErrorCode[] }
    | null = null;

  const dirty = (): boolean => isDirty(editor.current(), tracking);

  /** Translated when shown, so a language switch translates a pending notice too. */
  function noticeText(): string | null {
    if (notice === null) return null;
    return notice.kind === "storage"
      ? notice.problems.map((p) => translate(locale, PROBLEM_MESSAGE[p])).join(" ")
      : notice.codes.map((c) => levelErrorMessage(locale, c)).join(" ");
  }

  function renderStatus(): void {
    els.status.textContent =
      noticeText() ?? translate(locale, statusKey(editor.current(), tracking));
    els.status.classList.toggle("problem", notice !== null);
  }

  function render(levels: readonly SavedLevel[]): void {
    els.title.textContent = translate(locale, "myLevels");
    els.empty.textContent = translate(locale, "myLevelsEmpty");
    els.empty.hidden = levels.length > 0;
    els.save.textContent = translate(locale, "editorSave");
    resetConfirm(els.newLevel, "editorNew");
    els.list.replaceChildren(...levels.map(row));
    renderStatus();
  }

  /** Reads the list again; `extra` are the problems of the write just done. */
  function refresh(extra: readonly StorageProblem[] = []): void {
    const list = listLevels(store);
    const problems = [...new Set([...list.problems, ...extra])];
    notice = problems.length > 0 ? { kind: "storage", problems } : null;
    render(list.levels);
  }

  function row({ id, level }: SavedLevel): HTMLLIElement {
    const item = document.createElement("li");
    if (id === tracking.id) item.setAttribute("aria-current", "true");
    const name = document.createElement("span");
    name.className = "level-name";
    name.textContent = level.name;
    const size = document.createElement("span");
    size.className = "level-size";
    size.textContent = `${String(level.width)} × ${String(level.height)}`;
    const open = button("libraryOpen");
    confirmable(open, "libraryOpen", "confirmDiscard", dirty, () => {
      // As stored now: another tab may have saved a newer version since the list was drawn.
      const latest = getLevel(store, id);
      if (latest === null) {
        refresh(["not-found"]);
        return;
      }
      editor.load(editorFrom(latest.level));
      tracking = { id, saved: editor.current() };
      refresh();
    });
    const remove = button("libraryDelete");
    confirmable(
      remove,
      "libraryDelete",
      "confirmDelete",
      () => true,
      () => {
        const r = deleteLevel(store, id);
        if (id === tracking.id) tracking = { ...tracking, id: null }; // still in the editor, unsaved
        refresh(r.ok || r.problem === "not-found" ? [] : [r.problem]);
      },
    );
    item.append(name, size, open, remove);
    return item;
  }

  function button(key: MessageKey): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = translate(locale, key);
    return b;
  }

  /**
   * `run` on click, or on a second click when `needsConfirm()`: the first one turns the
   * label into the question. Leaving the button disarms it.
   */
  function confirmable(
    b: HTMLButtonElement,
    label: MessageKey,
    question: MessageKey,
    needsConfirm: () => boolean,
    run: () => void,
  ): void {
    b.addEventListener("click", () => {
      if (needsConfirm() && b.dataset.armed !== "true") {
        b.dataset.armed = "true";
        b.textContent = translate(locale, question);
        return;
      }
      resetConfirm(b, label);
      run();
    });
    const disarm = (): void => {
      if (b.dataset.armed === "true") resetConfirm(b, label);
    };
    b.addEventListener("blur", disarm);
    b.addEventListener("mouseleave", disarm);
  }

  function resetConfirm(b: HTMLButtonElement, label: MessageKey): void {
    delete b.dataset.armed;
    b.textContent = translate(locale, label);
  }

  els.save.addEventListener("click", () => {
    const draft = toDraft(editor.current());
    if (!draft.ok) {
      notice = { kind: "level", codes: [...new Set(draft.errors.map((e) => e.code))] };
      renderStatus();
      return;
    }
    let r = saveLevel(store, draft.level, tracking.id ?? undefined);
    // Deleted in another tab meanwhile: save it as a new level.
    if (!r.ok && r.problem === "not-found") r = saveLevel(store, draft.level);
    if (r.ok) tracking = { id: r.id, saved: editor.current() };
    refresh(r.ok ? [] : [r.problem]);
  });

  confirmable(els.newLevel, "editorNew", "confirmDiscard", dirty, () => {
    editor.load(newEditor(translate(locale, "defaultLevelName")));
    tracking = { id: null, saved: editor.current() };
    refresh();
  });

  // Another tab saved or deleted a level: show the list as it is now.
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === null) refresh();
  });

  refresh();

  return {
    setLocale(next) {
      tracking = relabelTracking(tracking, locale, next);
      locale = next;
      render(listLevels(store).levels); // keeps a pending notice, now translated
    },
    changed() {
      if (notice?.kind === "level") notice = null;
      renderStatus();
    },
  };
}
