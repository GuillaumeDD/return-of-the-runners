import { parseRoute, type Route } from "./app/route";
import { newEditor } from "./editor/model";
import { createLibraryView } from "./editor/library-view";
import { createEditorView } from "./editor/view";
import type { StorageLike } from "./storage/levels";
import { advance, type Accumulator } from "./game/loop";
import {
  PLAY_MODES,
  PLAY_SEED,
  createSession,
  playerCount,
  tickSession,
  type PlayMode,
  type Session,
} from "./game/session";
import { detectLocale, translate, type Locale, type MessageKey } from "./i18n";
import { inputsFrom, isBound, keyDown, keyUp, type HeldKeys } from "./input/keyboard";
import { modeFor, playerStatusText, statusMessage } from "./game/hud";
import { levelErrorMessage, uniqueCodes } from "./i18n/level-errors";
import type { Level, LevelErrorCode } from "./level/format";
import { parseLevel } from "./level/parse";
import { decodeLevel } from "./share/link";
import firstSteps from "./levels/first-steps.json?raw";
import { canvasSize, context2d, render } from "./render/canvas";
import type { ValidTest } from "./editor/view";
import { createState, maxPlayers } from "./sim/state";

function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`Missing #${id}`);
  return el;
}

const canvas = byId("screen", HTMLCanvasElement);
const title = byId("title", HTMLHeadingElement);
const subtitle = byId("subtitle", HTMLParagraphElement);
const message = byId("message", HTMLParagraphElement);
const langButton = byId("lang", HTMLButtonElement);
const navPlay = byId("nav-play", HTMLAnchorElement);
const navEdit = byId("nav-edit", HTMLAnchorElement);
const playScreen = byId("play-screen", HTMLElement);
const editScreen = byId("edit-screen", HTMLElement);
const editorMain = byId("editor-main", HTMLDivElement);
const testScreen = byId("test-screen", HTMLDivElement);
const testCanvas = byId("test-canvas", HTMLCanvasElement);
const testMessage = byId("test-message", HTMLParagraphElement);
const testBack = byId("test-back", HTMLButtonElement);
const sharedBar = byId("shared-bar", HTMLDivElement);
const sharedText = byId("shared-text", HTMLParagraphElement);
const sharedErrors = byId("shared-errors", HTMLUListElement);
const sharedEdit = byId("shared-edit", HTMLButtonElement);

/**
 * The play mode picked last; games started afterwards use it (a game already running
 * keeps its own until changed there). A level without a player 2 start plays alone.
 */
let picked: PlayMode = "solo";

/** Where a game shows its mode choice (for a level with a player 2 start) and its status line. */
interface PlayerEls {
  readonly group: HTMLElement;
  readonly buttons: Readonly<Record<PlayMode, HTMLButtonElement>>;
  readonly hud: HTMLElement;
}

function playerEls(prefix: string): PlayerEls {
  const button = (mode: PlayMode): HTMLButtonElement =>
    byId(`${prefix}-players-${mode}`, HTMLButtonElement);
  return {
    group: byId(`${prefix}-players`, HTMLDivElement),
    buttons: { solo: button("solo"), coop: button("coop"), versus: button("versus") },
    hud: byId(`${prefix}-hud`, HTMLParagraphElement),
  };
}

const MODE_LABEL: Readonly<Record<PlayMode, MessageKey>> = {
  solo: "players1",
  coop: "playersCoop",
  versus: "playersVersus",
};

const playPlayers = playerEls("play");
const testPlayers = playerEls("test");

let locale: Locale = detectLocale(navigator.languages);
let messageKey: MessageKey = "controls";

function renderText(): void {
  document.documentElement.lang = locale;
  document.title = translate(locale, "title");
  title.textContent = translate(locale, "title");
  subtitle.textContent = translate(locale, "subtitle");
  message.textContent = translate(locale, messageKey);
  langButton.textContent = translate(locale, "switchLanguage");
  navPlay.textContent = translate(locale, "navPlay");
  navEdit.textContent = translate(locale, "navEdit");
  testMessage.textContent = translate(locale, testMessageKey);
  testBack.textContent = translate(locale, "testBack");
  sharedEdit.textContent = translate(locale, "sharedEdit");
  for (const els of [playPlayers, testPlayers]) {
    els.group.setAttribute("aria-label", translate(locale, "playersLabel"));
    for (const mode of PLAY_MODES) {
      els.buttons[mode].textContent = translate(locale, MODE_LABEL[mode]);
    }
  }
  playing?.relabel();
  testGame?.relabel();
  editor.setLocale(locale);
  library.setLocale(locale);
  renderShared();
}

langButton.addEventListener("click", () => {
  locale = locale === "en" ? "fr" : "en";
  renderText();
});

/** A game: runs only while its screen is shown. */
interface Game {
  readonly resume: () => void;
  readonly pause: () => void;
  /** Redraws its texts in the current locale. */
  readonly relabel: () => void;
}

/**
 * A game of `level` on `target`, alone or with two players in co-op or versus
 * (`picked`, if the level allows two); `onStatus` gets the message to show whenever the
 * game's status or mode changes.
 */
function createGame(
  target: HTMLCanvasElement,
  els: PlayerEls,
  level: Level,
  onStatus: (key: MessageKey) => void,
): Game {
  const context = context2d(target);
  let mode = modeFor(level, picked);
  let count = playerCount(mode);
  let session = newSession();
  let shown: MessageKey | null = null;
  let hudText: string | null = null;
  let held: HeldKeys = new Set();
  let acc: Accumulator = { carry: 0 };
  let last: number | null = null;
  let frameId: number | null = null;

  function newSession(): Session {
    return createSession(createState(level, PLAY_SEED, count));
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    // Browser shortcuts (Ctrl+S, Ctrl+D…) are not game keys.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Arrows must not scroll the page, nor / open Firefox's quick find.
    if (isBound(e.code, count)) e.preventDefault();
    held = keyDown(held, e.code);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    held = keyUp(held, e.code);
  };
  // Releasing a key while the window is unfocused never fires keyup: clear everything.
  const onBlur = (): void => {
    held = new Set();
  };

  /** A new game in mode `m`, from the start of the level. */
  const choose = (m: PlayMode): void => {
    picked = m;
    // Keys go to the game, not to the button just clicked.
    els.buttons[m].blur();
    if (modeFor(level, m) === mode) return;
    mode = modeFor(level, m);
    count = playerCount(mode);
    session = newSession();
    acc = { carry: 0 };
    showPlayers();
  };
  const onChoose: Readonly<Record<PlayMode, () => void>> = {
    solo: () => {
      choose("solo");
    },
    coop: () => {
      choose("coop");
    },
    versus: () => {
      choose("versus");
    },
  };

  function showPlayers(): void {
    els.group.hidden = maxPlayers(level) < 2;
    for (const m of PLAY_MODES) els.buttons[m].setAttribute("aria-pressed", String(m === mode));
    els.hud.hidden = count < 2;
    shown = null; // the next frame shows the message and status line again
    hudText = null;
  }

  const frame = (now: number): void => {
    const result = advance(acc, last === null ? 0 : now - last);
    last = now;
    acc = result.acc;
    const inputs = inputsFrom(held, count);
    for (let i = 0; i < result.ticks; i++) session = tickSession(session, inputs);
    const key = statusMessage(session.state, mode);
    if (key !== shown) {
      shown = key;
      onStatus(key);
    }
    const text = playerStatusText(locale, session.state);
    if (text !== hudText) {
      hudText = text;
      els.hud.textContent = text;
    }
    render(context, session.state);
    frameId = requestAnimationFrame(frame);
  };

  return {
    resume() {
      if (frameId !== null) return;
      // Sized on every resume: a shared level and the bundled one share the play canvas.
      const size = canvasSize(session.state);
      target.width = size.width;
      target.height = size.height;
      showPlayers();
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      for (const m of PLAY_MODES) els.buttons[m].addEventListener("click", onChoose[m]);
      last = null; // no catch-up for the time spent on another screen
      frameId = requestAnimationFrame(frame);
    },
    pause() {
      if (frameId === null) return;
      cancelAnimationFrame(frameId);
      frameId = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      for (const m of PLAY_MODES) els.buttons[m].removeEventListener("click", onChoose[m]);
      held = new Set();
    },
    relabel() {
      hudText = null;
    },
  };
}

// The level being edited lives as long as the page, across visits to other screens.
const editor = createEditorView(
  {
    canvas: byId("editor-grid", HTMLCanvasElement),
    palette: byId("editor-palette", HTMLDivElement),
    name: byId("editor-name", HTMLInputElement),
    width: byId("editor-width", HTMLInputElement),
    height: byId("editor-height", HTMLInputElement),
    undo: byId("editor-undo", HTMLButtonElement),
    redo: byId("editor-redo", HTMLButtonElement),
    test: byId("editor-test", HTMLButtonElement),
    errors: byId("editor-errors", HTMLDivElement),
    errorList: byId("editor-error-list", HTMLUListElement),
    labels: {
      name: byId("editor-name-label", HTMLSpanElement),
      width: byId("editor-width-label", HTMLSpanElement),
      height: byId("editor-height-label", HTMLSpanElement),
      hint: byId("editor-hint", HTMLParagraphElement),
      errors: byId("editor-errors-label", HTMLParagraphElement),
    },
  },
  {
    initial: newEditor(translate(locale, "defaultLevelName")),
    locale,
    onTest: startTestPlay,
    onChange: () => {
      library.changed();
    },
  },
);

/** The browser's storage; reading `localStorage` itself throws when site data is blocked. */
function browserStorage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    const refuse = (): never => {
      throw new DOMException("Storage is disabled", "SecurityError");
    };
    return { getItem: refuse, setItem: refuse };
  }
}

const library = createLibraryView(
  {
    save: byId("editor-save", HTMLButtonElement),
    newLevel: byId("editor-new", HTMLButtonElement),
    exportFile: byId("editor-export", HTMLButtonElement),
    importFile: byId("editor-import", HTMLButtonElement),
    fileInput: byId("editor-file", HTMLInputElement),
    share: byId("editor-share", HTMLButtonElement),
    shareLink: byId("editor-share-link", HTMLInputElement),
    status: byId("editor-status", HTMLParagraphElement),
    title: byId("my-levels-title", HTMLHeadingElement),
    list: byId("my-levels-list", HTMLUListElement),
    empty: byId("my-levels-empty", HTMLParagraphElement),
  },
  browserStorage(),
  editor,
  locale,
);

/** The level being tested, while "Test" runs; null in the editor itself. */
let testGame: Game | null = null;
let testMessageKey: MessageKey = "testHint";

function startTestPlay(test: ValidTest): void {
  editor.hide();
  editorMain.hidden = true;
  testScreen.hidden = false;
  const showStatus = (key: MessageKey): void => {
    testMessageKey =
      key === "controls"
        ? "testHint"
        : key === "controls2" || key === "controlsVersus"
          ? "testHint2"
          : key;
    testMessage.textContent = translate(locale, testMessageKey);
  };
  showStatus("controls"); // not the last test's "Caught!"
  testGame = createGame(testCanvas, testPlayers, test.level, showStatus);
  testGame.resume();
  window.addEventListener("keydown", onTestKey);
}

/** Back to the editor, which kept its state (undo history included) during the test. */
function stopTestPlay(): void {
  if (testGame === null) return;
  testGame.pause();
  testGame = null;
  window.removeEventListener("keydown", onTestKey);
  testScreen.hidden = true;
  editorMain.hidden = false;
  editor.show();
  editor.focusTest();
}

function onTestKey(e: KeyboardEvent): void {
  if (e.code === "Escape") stopTestPlay();
}
testBack.addEventListener("click", stopTestPlay);
// The Editor tab during a test goes back to the editor (the hash is already #edit, so
// no hashchange fires).
navEdit.addEventListener("click", stopTestPlay);

const showMessage = (key: MessageKey): void => {
  messageKey = key;
  message.textContent = translate(locale, key);
};

/** The bundled level, on the play screen. */
let game: Game | null = null;
const parsed = parseLevel(firstSteps);
if (parsed.ok) {
  game = createGame(canvas, playPlayers, parsed.level, showMessage);
} else {
  messageKey = "levelError";
  console.error("Bundled level is invalid", parsed.errors);
}

/**
 * The level of a share link, also on the play screen. Decoding is asynchronous, so it
 * is "opening" until done. Kept while the same link is shown, so coming back to it
 * (back button) resumes the same game.
 */
type SharedState =
  | { readonly kind: "opening" }
  | { readonly kind: "ready"; readonly level: Level; readonly game: Game }
  | { readonly kind: "broken"; readonly codes: readonly LevelErrorCode[] };
let shared: { readonly payload: string; state: SharedState } | null = null;
/** "Edit a copy" found no room for the copy (see `editCopy`). */
let copyFailed = false;
/** The game on the play screen: the bundled one or a shared one. */
let playing: Game | null = null;

function openShared(payload: string): void {
  if (shared?.payload === payload) return;
  const opening: { readonly payload: string; state: SharedState } = {
    payload,
    state: { kind: "opening" },
  };
  shared = opening;
  copyFailed = false;
  void decodeLevel(payload).then((r) => {
    if (shared !== opening) return; // another link was opened meanwhile
    opening.state = r.ok
      ? {
          kind: "ready",
          level: r.level,
          game: createGame(canvas, playPlayers, r.level, showMessage),
        }
      : { kind: "broken", codes: uniqueCodes(r.errors) };
    const route = parseRoute(location.hash);
    if (route.screen === "shared" && route.payload === payload) show(route);
  });
}

/** The bar above a shared level: its name and "Edit a copy", or why it cannot open. */
function renderShared(): void {
  const state = shared?.state ?? { kind: "opening" };
  switch (state.kind) {
    case "opening":
      sharedText.textContent = translate(locale, "sharedOpening");
      break;
    case "ready":
      // A name from the link: textContent only.
      sharedText.textContent = translate(locale, "sharedTitle").replace(
        "{name}",
        () => state.level.name,
      );
      break;
    case "broken":
      sharedText.textContent = translate(locale, "sharedBroken");
      break;
  }
  const lines =
    state.kind === "broken"
      ? state.codes.map((code) => levelErrorMessage(locale, code))
      : copyFailed
        ? [translate(locale, "sharedCopyFailed")]
        : [];
  sharedErrors.replaceChildren(
    ...lines.map((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      return item;
    }),
  );
  sharedEdit.hidden = state.kind !== "ready";
}

sharedEdit.addEventListener("click", () => {
  if (shared?.state.kind !== "ready") return;
  // Not copied anywhere: stay here, so the level is not lost.
  copyFailed = !library.editCopy(shared.state.level);
  if (copyFailed) renderShared();
  else location.hash = "#edit";
});

const TABS: readonly (readonly [HTMLAnchorElement, Route["screen"]])[] = [
  [navPlay, "play"],
  [navEdit, "edit"],
];

function show(route: Route): void {
  const editing = route.screen === "edit";
  playScreen.hidden = editing;
  editScreen.hidden = !editing;
  // A shared level is neither tab.
  for (const [link, screen] of TABS) {
    if (screen === route.screen) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (route.screen === "shared") openShared(route.payload);
  const sharedState = route.screen === "shared" ? shared?.state : undefined;
  let next: Game | null = null;
  if (route.screen === "play") next = game;
  else if (sharedState?.kind === "ready") next = sharedState.game;
  if (playing !== next) playing?.pause();
  playing = next;
  sharedBar.hidden = route.screen !== "shared";
  // A link still opening, or broken: no game to show.
  const noGame = route.screen === "shared" && next === null;
  canvas.hidden = noGame;
  message.hidden = noGame;
  if (noGame) {
    playPlayers.group.hidden = true;
    playPlayers.hud.hidden = true;
  }
  if (route.screen === "shared") renderShared();
  if (editing) {
    editor.show();
  } else {
    stopTestPlay();
    editor.hide();
    playing?.resume();
  }
}

window.addEventListener("hashchange", () => {
  show(parseRoute(location.hash));
});
renderText();
show(parseRoute(location.hash));
