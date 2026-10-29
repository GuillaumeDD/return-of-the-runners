import { translate, type Locale } from "../i18n";
import { levelErrorMessage } from "../i18n/level-errors";
import type { LevelErrorCode } from "../level/format";
import { LIMITS, TILE } from "../level/format";
import { context2d, gridCanvasSize, renderGrid } from "../render/canvas";
import { parseSize, relabelName } from "./fields";
import { PALETTE, shortcutFor, tileForKey } from "./keys";
import { redo, rename, resize, selectLinkTool, selectTile, undo, type EditorState } from "./model";
import { startTest, testErrors, type TestStart } from "./test-play";
import { cellAt, onPointer, startsDrag, type Drag, type PointerInput } from "./pointer";

/** The editor screen's elements, from index.html. */
export interface EditorElements {
  readonly canvas: HTMLCanvasElement;
  readonly palette: HTMLElement;
  readonly name: HTMLInputElement;
  readonly width: HTMLInputElement;
  readonly height: HTMLInputElement;
  readonly undo: HTMLButtonElement;
  readonly redo: HTMLButtonElement;
  readonly test: HTMLButtonElement;
  /** Shown after a "Test" refused by the validator, until the level is valid. */
  readonly errors: HTMLElement;
  readonly errorList: HTMLUListElement;
  /** Translated labels: each element's text is set from its message key. */
  readonly labels: {
    readonly name: HTMLElement;
    readonly width: HTMLElement;
    readonly height: HTMLElement;
    readonly hint: HTMLElement;
    readonly errors: HTMLElement;
  };
}

/** A test that may start: the level passed the validator. */
export type ValidTest = Extract<TestStart, { ok: true }>;

export interface EditorOptions {
  readonly initial: EditorState;
  readonly locale: Locale;
  /** "Test" was pressed on a valid level. */
  readonly onTest: (test: ValidTest) => void;
  /** The level (grid or name) changed. */
  readonly onChange: () => void;
}

export interface EditorView {
  /** Starts listening to the keyboard and draws the level. */
  readonly show: () => void;
  readonly hide: () => void;
  readonly setLocale: (locale: Locale) => void;
  /** Puts the keyboard focus on "Test", where it was before a test started. */
  readonly focusTest: () => void;
  /** The level being edited. */
  readonly current: () => EditorState;
  /** Replaces the level being edited (a new or opened level). */
  readonly load: (state: EditorState) => void;
}

/**
 * The DOM layer of the editor: turns mouse, keyboard and field events into model
 * operations (`model.ts`, `pointer.ts`, `keys.ts`) and draws the result. Every text
 * goes through `textContent`, never `innerHTML`.
 */
export function createEditorView(els: EditorElements, options: EditorOptions): EditorView {
  const { initial, onTest, onChange } = options;
  const ctx = context2d(els.canvas);
  let editor = initial;
  let drag: Drag | null = null;
  let locale = options.locale;
  /** The errors of the last refused test, refreshed on every change; null when hidden. */
  let errors: readonly LevelErrorCode[] | null = null;

  const swatches = PALETTE.map(({ tile }, i) => {
    const button = document.createElement("button");
    button.type = "button";
    const swatch = document.createElement("canvas");
    const size = gridCanvasSize([tile]);
    swatch.width = size.width;
    swatch.height = size.height;
    renderGrid(context2d(swatch), [tile]);
    const label = document.createElement("span");
    button.append(swatch, label);
    if (i < 10) {
      // Keys 1–9, then 0 for the tenth entry.
      const key = document.createElement("kbd");
      key.textContent = String((i + 1) % 10);
      button.append(key);
    }
    button.addEventListener("click", () => {
      update(selectTile(editor, tile));
    });
    els.palette.append(button);
    return { button, label, tile };
  });

  // The link tool, after the tiles: its swatch is an entrance linked to an exit.
  const linkButton = document.createElement("button");
  linkButton.type = "button";
  const linkSwatch = document.createElement("canvas");
  const linkTiles = [`${TILE.teleportEntrance}${TILE.teleportExit}`];
  const linkSize = gridCanvasSize(linkTiles);
  linkSwatch.width = linkSize.width;
  linkSwatch.height = linkSize.height;
  renderGrid(context2d(linkSwatch), linkTiles, [[0, 0, 1, 0]]);
  const linkLabel = document.createElement("span");
  linkButton.append(linkSwatch, linkLabel);
  linkButton.addEventListener("click", () => {
    update(selectLinkTool(editor));
  });
  els.palette.append(linkButton);

  els.width.min = String(LIMITS.minWidth);
  els.width.max = String(LIMITS.maxWidth);
  els.height.min = String(LIMITS.minHeight);
  els.height.max = String(LIMITS.maxHeight);

  function draw(): void {
    const size = gridCanvasSize(editor.grid);
    if (els.canvas.width !== size.width) els.canvas.width = size.width;
    if (els.canvas.height !== size.height) els.canvas.height = size.height;
    renderGrid(ctx, editor.grid, editor.teleports, editor.linkFrom);
  }

  function syncFields(): void {
    els.width.value = String(editor.grid[0]?.length ?? 0);
    els.height.value = String(editor.grid.length);
    els.undo.disabled = editor.undo.length === 0;
    els.redo.disabled = editor.redo.length === 0;
    const painting = editor.tool === "paint";
    for (const s of swatches) {
      s.button.setAttribute("aria-pressed", String(painting && s.tile === editor.tile));
    }
    linkButton.setAttribute("aria-pressed", String(!painting));
  }

  function update(next: EditorState): void {
    const redraw =
      next.grid !== editor.grid ||
      next.teleports !== editor.teleports ||
      next.linkFrom !== editor.linkFrom;
    const revalidate =
      next.grid !== editor.grid || next.teleports !== editor.teleports || next.name !== editor.name;
    editor = next;
    if (redraw) draw();
    if (revalidate && errors !== null) showErrors(testErrors(editor));
    if (revalidate) onChange();
    syncFields();
  }

  function showErrors(codes: readonly LevelErrorCode[] | null): void {
    errors = codes;
    els.errors.hidden = codes === null;
    els.errorList.replaceChildren(
      ...(codes ?? []).map((code) => {
        const item = document.createElement("li");
        item.textContent = levelErrorMessage(locale, code);
        return item;
      }),
    );
  }

  function setLocale(next: Locale): void {
    update(rename(editor, relabelName(editor.name, locale, next)));
    els.name.value = editor.name;
    locale = next;
    els.labels.name.textContent = translate(locale, "editorName");
    els.labels.width.textContent = translate(locale, "editorWidth");
    els.labels.height.textContent = translate(locale, "editorHeight");
    els.labels.hint.textContent = translate(locale, "editorHint");
    els.undo.textContent = translate(locale, "editorUndo");
    els.redo.textContent = translate(locale, "editorRedo");
    els.test.textContent = translate(locale, "editorTest");
    els.labels.errors.textContent = translate(locale, "editorErrors");
    showErrors(errors);
    els.palette.setAttribute("aria-label", translate(locale, "editorPalette"));
    PALETTE.forEach(({ name }, i) => {
      const s = swatches[i];
      if (s) s.label.textContent = translate(locale, name);
    });
    linkLabel.textContent = translate(locale, "editorLinkTool");
    linkButton.title = translate(locale, "editorLinkHint");
  }

  // Pointer: painting with the mouse (or a finger).
  function pointer(input: PointerInput): void {
    const result = onPointer(editor, drag, input);
    drag = result.drag;
    update(result.editor);
  }
  function cellOf(e: PointerEvent): ReturnType<typeof cellAt> {
    const rect = els.canvas.getBoundingClientRect();
    return cellAt(
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height,
      editor.grid[0]?.length ?? 0,
      editor.grid.length,
    );
  }
  els.canvas.addEventListener("pointerdown", (e) => {
    if (!startsDrag(drag, e.button)) return;
    e.preventDefault(); // no text selection; it also keeps focus where it was, so:
    // leave the name or size field, so number keys pick tiles again.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    els.canvas.setPointerCapture(e.pointerId);
    pointer({ kind: "down", pointer: e.pointerId, button: e.button, cell: cellOf(e) });
  });
  els.canvas.addEventListener("pointermove", (e) => {
    if (drag === null) return;
    pointer({ kind: "move", pointer: e.pointerId, buttons: e.buttons, cell: cellOf(e) });
  });
  // Release, cancel, or capture lost: the stroke ends in every case.
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    els.canvas.addEventListener(type, (e) => {
      if (drag !== null) pointer({ kind: "end", pointer: e.pointerId });
    });
  }
  // The right button erases: no context menu on the grid.
  els.canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  // Fields and buttons.
  els.name.value = editor.name;
  els.name.addEventListener("input", () => {
    update(rename(editor, els.name.value));
  });
  // A pasted name longer than the cap shows what is kept.
  els.name.addEventListener("change", () => {
    els.name.value = editor.name;
  });
  const onSize = (): void => {
    update(resize(editor, parseSize(els.width.value), parseSize(els.height.value)));
    syncFields(); // shows the clamped size, even when nothing changed
  };
  els.width.addEventListener("change", onSize);
  els.height.addEventListener("change", onSize);
  els.undo.addEventListener("click", () => {
    update(undo(editor));
  });
  els.redo.addEventListener("click", () => {
    update(redo(editor));
  });
  els.test.addEventListener("click", () => {
    const result = startTest(editor);
    showErrors(result.ok ? null : result.errors);
    if (result.ok) onTest(result);
  });

  // Keyboard: number keys pick a tile, Ctrl+Z / Ctrl+Y undo and redo. Not while typing
  // in a field, where the keys belong to the field.
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return;
    const shortcut = shortcutFor(e);
    if (shortcut !== null) {
      e.preventDefault();
      update(shortcut === "undo" ? undo(editor) : redo(editor));
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tile = tileForKey(e.code);
    if (tile !== null) update(selectTile(editor, tile));
  };

  setLocale(locale);
  syncFields();

  return {
    show() {
      window.addEventListener("keydown", onKeyDown);
      draw();
    },
    hide() {
      window.removeEventListener("keydown", onKeyDown);
      if (drag !== null) pointer({ kind: "end", pointer: drag.pointer });
    },
    setLocale,
    focusTest() {
      els.test.focus();
    },
    current: () => editor,
    load(state) {
      if (drag !== null) pointer({ kind: "end", pointer: drag.pointer });
      showErrors(null);
      update(state);
      els.name.value = editor.name;
      draw();
    },
  };
}
