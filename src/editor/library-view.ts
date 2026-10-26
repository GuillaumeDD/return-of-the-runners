import { translate, type Locale, type MessageKey } from "../i18n";
import { uniqueCodes } from "../i18n/level-errors";
import { shareUrl } from "../app/route";
import type { Level, LevelErrorCode } from "../level/format";
import { draftOf } from "../level/serialize";
import { encodeLevel } from "../share/link";
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
import {
  afterEdit,
  copyOutcome,
  isDirty,
  isProblem,
  relabelTracking,
  statusText,
  type Notice,
  type Tracking,
} from "./library";
import { exportLevel, importLevel } from "../level/file";
import { editorFrom, newEditor, toDraft, toLevel } from "./model";
import type { EditorView } from "./view";

/** "My levels" elements, from index.html. */
export interface LibraryElements {
  readonly save: HTMLButtonElement;
  readonly newLevel: HTMLButtonElement;
  readonly exportFile: HTMLButtonElement;
  readonly importFile: HTMLButtonElement;
  /** A hidden `<input type="file">`, opened by the Import button. */
  readonly fileInput: HTMLInputElement;
  readonly share: HTMLButtonElement;
  /** Read-only field showing the last share link, until the next edit. */
  readonly shareLink: HTMLInputElement;
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
  /**
   * "Edit a copy" of a shared level: saves it as a new level in "My levels" and opens
   * it, unless the editor has unsaved changes (then it waits in the list, and the
   * status line says so). False when it is in neither place: the editor had unsaved
   * changes and the browser refused to store the copy.
   */
  readonly editCopy: (level: Level) => boolean;
}

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
  let notice: Notice | null = null;

  const dirty = (): boolean => isDirty(editor.current(), tracking);

  function levelNotice(
    prefix: MessageKey | null,
    errors: readonly { code: LevelErrorCode }[],
  ): void {
    notice = { kind: "level", prefix, codes: uniqueCodes(errors) };
    renderStatus();
  }

  function renderStatus(): void {
    els.status.textContent = statusText(locale, notice, editor.current(), tracking);
    els.status.classList.toggle("problem", isProblem(notice));
  }

  function render(levels: readonly SavedLevel[]): void {
    els.title.textContent = translate(locale, "myLevels");
    els.empty.textContent = translate(locale, "myLevelsEmpty");
    els.empty.hidden = levels.length > 0;
    els.save.textContent = translate(locale, "editorSave");
    els.exportFile.textContent = translate(locale, "editorExport");
    els.share.textContent = translate(locale, "editorShare");
    els.shareLink.setAttribute("aria-label", translate(locale, "shareLinkLabel"));
    resetConfirm(els.importFile, "editorImport");
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
      levelNotice(null, draft.errors);
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

  // Export: the exact v1 document as a file, for a playable level only.
  els.exportFile.addEventListener("click", () => {
    const result = toLevel(editor.current());
    if (!result.ok) {
      levelNotice("exportRefused", result.errors);
      return;
    }
    const { fileName, text } = exportLevel(result.level);
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.hidden = true;
    document.body.append(link); // Firefox ignores a click on a detached link
    link.click();
    link.remove();
    // Revoked a moment later: the download has started by then.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    notice = { kind: "info", key: "statusExported" };
    renderStatus();
  });

  // Import: opens a file as a new, unsaved level (Save keeps it in "My levels").
  confirmable(els.importFile, "editorImport", "confirmDiscard", dirty, () => {
    els.fileInput.value = ""; // the same file twice still fires "change"
    els.fileInput.click();
  });
  /** Counts imports, so only the latest one, on an unchanged editor, is applied. */
  let importTicket = 0;
  els.fileInput.addEventListener("change", () => {
    const file = els.fileInput.files?.[0];
    if (file === undefined) return;
    const ticket = ++importTicket;
    const before = editor.current();
    void importLevel(file).then((result) => {
      // The file took a while: a later import, an edit or an opened level wins.
      if (ticket !== importTicket || editor.current() !== before) return;
      if (!result.ok) {
        levelNotice("importRefused", result.errors);
        return;
      }
      editor.load(editorFrom(result.level));
      tracking = { id: null, saved: editor.current() };
      refresh();
    });
  });

  // Share: a link holding the whole level, for a playable level only. Also shown in a
  // field, since the clipboard can be refused.
  let shareTicket = 0;
  els.share.addEventListener("click", () => {
    const result = toLevel(editor.current());
    hideShareLink();
    if (!result.ok) {
      levelNotice("shareRefused", result.errors);
      return;
    }
    const ticket = ++shareTicket;
    const before = editor.current();
    const url = encodeLevel(result.level).then((payload) => shareUrl(location.href, payload));
    // Refused (permissions, no secure context): the field still has the link.
    const copied = copyText(url).then(
      () => true,
      () => false,
    );
    void Promise.all([url, copied]).then(([link, ok]) => {
      // An edit meanwhile: that link would not be the level on screen.
      if (ticket !== shareTicket || editor.current() !== before) return;
      els.shareLink.value = link;
      els.shareLink.hidden = false;
      els.shareLink.select();
      notice = { kind: "info", key: ok ? "statusLinkCopied" : "statusLinkReady" };
      renderStatus();
    });
  });

  /**
   * Copies text that is still being made. Called within the click: Safari lets a page
   * write the clipboard only during a user gesture, so the write starts now with a
   * promise of the text (`ClipboardItem`), not once the link is ready.
   */
  async function copyText(text: Promise<string>): Promise<void> {
    if (typeof ClipboardItem !== "undefined") {
      const blob = text.then((t) => new Blob([t], { type: "text/plain" }));
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      return;
    }
    await navigator.clipboard.writeText(await text);
  }

  function hideShareLink(): void {
    els.shareLink.hidden = true;
    els.shareLink.value = "";
  }

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
      notice = afterEdit(notice);
      shareTicket++; // a link being made is for the level before this edit
      hideShareLink();
      renderStatus();
    },
    editCopy(level) {
      const r = saveLevel(store, draftOf(level));
      const outcome = copyOutcome(dirty(), r.ok);
      if (outcome === "refused") return false;
      const before = editor.current();
      if (outcome !== "in-list") editor.load(editorFrom(level));
      if (outcome === "open-saved" && r.ok) tracking = { id: r.id, saved: editor.current() };
      // Not stored: compared with the level it replaced, so New or Open asks first.
      if (outcome === "open-unsaved") tracking = { id: null, saved: before };
      refresh(r.ok ? [] : [r.problem]);
      if (outcome === "in-list") {
        notice = { kind: "info", key: "statusCopiedShared" };
        renderStatus();
      }
      return true;
    },
  };
}
