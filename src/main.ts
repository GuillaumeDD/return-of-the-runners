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
  levelDone,
  playerCount,
  tickSession,
  type AfterWin,
  type PlayMode,
  type Session,
} from "./game/session";
import { detectLocale, translate, type Locale, type MessageKey } from "./i18n";
import { inputsFrom, isBound, keyDown, keyUp, type HeldKeys } from "./input/keyboard";
import { modeFor, playerPanels, playerStatusText, statusMessage } from "./game/hud";
import { drawFrame, drawHud, frameLayout } from "./render/hud";
import { levelErrorMessage, uniqueCodes } from "./i18n/level-errors";
import type { Level, LevelErrorCode } from "./level/format";
import { parseLevel } from "./level/parse";
import { decodeLevel } from "./share/link";
import { PACKS, nextIndex, packModes, packStartMode, progressKey, type Pack } from "./levels/pack";
import { markDone, readProgress, saveProgress, type Progress } from "./storage/progress";
import { canvasSize, context2d, fillBackdrop, render } from "./render/canvas";
import { detectEvents, drawEffects, type Effect, shakeAt, updateEffects } from "./render/effects";
import {
  fitCanvas,
  GAME_SIZES,
  gameWidth,
  parseGameSize,
  roomHeight,
  type GameSize,
} from "./render/scale";
import { type Motion, trackMotion } from "./render/actors";
import { sheetAt } from "./render/sheet";
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
const sizeSelect = byId("size", HTMLSelectElement);
const sizeLabel = byId("size-label", HTMLLabelElement);
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
const packBar = byId("play-pack", HTMLDivElement);
const packLabel = byId("play-pack-label", HTMLSpanElement);
const packChoice = byId("play-pack-choice", HTMLSelectElement);
const levelLabel = byId("play-level-label", HTMLSpanElement);
const packSelect = byId("play-level", HTMLSelectElement);
/** The player asked the system for less motion: no shake, no flashes, fewer particles. */
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/**
 * The play mode picked last; games started afterwards use it (a game already running
 * keeps its own until changed there). A level without a player 2 start plays alone.
 */
let picked: PlayMode = "solo";

/** Where a game shows its mode choice (for a level with a player 2 start) and its screen-reader status line. */
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
  sizeLabel.textContent = translate(locale, "sizeLabel");
  renderSizes();
  navPlay.textContent = translate(locale, "navPlay");
  navEdit.textContent = translate(locale, "navEdit");
  testMessage.textContent = translate(locale, testMessageKey);
  testBack.textContent = translate(locale, "testBack");
  sharedEdit.textContent = translate(locale, "sharedEdit");
  packLabel.textContent = translate(locale, "packLabel");
  levelLabel.textContent = translate(locale, "levelLabel");
  renderPack();
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

/** Where the game's size is remembered, for this browser only. */
const SIZE_KEY = "rotr.size";

function readSize(): GameSize {
  try {
    return parseGameSize(browserStorage().getItem(SIZE_KEY));
  } catch {
    return "fit"; // site data blocked: the default, every time
  }
}

/** The game's size, picked under the game (B-048); every game canvas follows it. */
let gameSize: GameSize = readSize();

function renderSizes(): void {
  sizeSelect.replaceChildren(
    ...GAME_SIZES.map((size) => {
      const option = document.createElement("option");
      option.value = String(size);
      option.textContent =
        size === "fit"
          ? translate(locale, "sizeFit")
          : translate(locale, "sizePercent").replace("{n}", () => String(size));
      option.selected = size === gameSize;
      return option;
    }),
  );
}

sizeSelect.addEventListener("change", () => {
  gameSize = parseGameSize(sizeSelect.value);
  try {
    browserStorage().setItem(SIZE_KEY, String(gameSize));
  } catch {
    // Not remembered when site data is blocked; the size still applies now.
  }
  playing?.refit();
  testGame?.refit();
  editor.refit();
});

/**
 * The room a canvas has: the width of its screen, and the window's height less
 * everything else on the page down to `last` (the whole page by default), so that
 * "fit" shows all of that (B-048, B-050).
 */
function roomFor(
  target: HTMLCanvasElement,
  last: Element | null = target.closest("main"),
): { width: number; height: number } {
  const screen = target.parentElement;
  const page = target.closest("main");
  const width = screen === null ? window.innerWidth : screen.clientWidth;
  if (page === null || last === null) return { width, height: window.innerHeight };
  const height = roomHeight(
    window.innerHeight,
    page.getBoundingClientRect(),
    last.getBoundingClientRect(),
    target.getBoundingClientRect(),
  );
  return { width, height };
}

/** A game: runs only while its screen is shown. */
interface Game {
  readonly resume: () => void;
  readonly pause: () => void;
  /** Redraws its texts in the current locale. */
  readonly relabel: () => void;
  /** Sizes its canvas again, after the player picked another size. */
  readonly refit: () => void;
}

/** How a level of the pack differs from a single level (a shared link, a test). */
interface InPack {
  /** The level's title in the current locale, for the status bar. */
  readonly title: () => string;
  /** Called once, when the level was won and its end screen is over. */
  readonly onDone: () => void;
  /** The modes the pack offers, and the one the level starts in. */
  readonly modes: readonly PlayMode[];
  readonly start: PlayMode;
}

/**
 * A game of `level` on `target`, alone or with two players in co-op or versus
 * (`picked`, if the level allows two); `onStatus` gets the message to show whenever the
 * game's status or mode changes. A single level is played again once won; a level of
 * the pack hands over to the next one (`pack`).
 */
function createGame(
  target: HTMLCanvasElement,
  els: PlayerEls,
  level: Level,
  onStatus: (key: MessageKey) => void,
  pack?: InPack,
): Game {
  const afterWin: AfterWin = pack === undefined ? "again" : "next";
  let reported = false;
  const context = context2d(target);
  let scale = 1;
  let motion: Motion | null = null;
  let effects: Effect[] = [];
  const fit = (): void => {
    const logical = frameLayout(canvasSize(session.state));
    const width = gameWidth(gameSize, logical, roomFor(target));
    scale = fitCanvas(target, context, logical, width);
  };
  const modes = pack?.modes ?? PLAY_MODES;
  let mode = modeFor(level, pack?.start ?? picked);
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
    if (!modes.includes(m)) return;
    picked = m;
    // Keys go to the game, not to the button just clicked.
    els.buttons[m].blur();
    if (modeFor(level, m) === mode) return;
    mode = modeFor(level, m);
    count = playerCount(mode);
    session = newSession();
    acc = { carry: 0 };
    effects = [];
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
    els.group.hidden = maxPlayers(level) < 2 || modes.length < 2;
    for (const m of PLAY_MODES) {
      els.buttons[m].hidden = !modes.includes(m);
      els.buttons[m].setAttribute("aria-pressed", String(m === mode));
    }
    shown = null; // the next frame shows the message and status line again
    hudText = null;
  }

  const frame = (now: number): void => {
    const result = advance(acc, last === null ? 0 : now - last);
    last = now;
    acc = result.acc;
    const inputs = inputsFrom(held, count);
    const before = session.state;
    for (let i = 0; i < result.ticks; i++) session = tickSession(session, inputs, afterWin);
    // A restarted level starts with a clean slate.
    if (session.state.tick < before.tick) effects = [];
    effects = updateEffects(effects, detectEvents(before, session.state), now);
    const key = statusMessage(session.state, mode, afterWin);
    if (key !== shown) {
      shown = key;
      onStatus(key);
    }
    const text = playerStatusText(locale, session.state);
    if (text !== hudText) {
      hudText = text;
      els.hud.textContent = text;
      els.hud.hidden = text === "";
    }
    motion = trackMotion(motion, session.state);
    const reduced = reducedMotion.matches;
    const shake = shakeAt(effects, now, reduced);
    const layout = frameLayout(canvasSize(session.state));
    const { field } = layout;
    const sheet = sheetAt(scale, level.world, level.night);
    const scene = { world: level.world, night: level.night };
    drawFrame(context, layout);
    const name = pack === undefined ? level.name : pack.title();
    drawHud(context, layout, sheet, locale, playerPanels(session.state), name);
    context.save();
    context.beginPath();
    context.rect(field.x, field.y, field.width, field.height);
    context.clip();
    // The playfield starts on a whole device pixel, so tile edges stay sharp.
    context.translate(Math.round(field.x * scale) / scale, Math.round(field.y * scale) / scale);
    // What a shaken scene uncovers at the edges.
    fillBackdrop(context, field.width, field.height, sheet, scene);
    context.translate(shake.x, shake.y);
    render(context, session.state, sheet, now, motion, scene);
    drawEffects(context, effects, now, reduced);
    context.restore();
    if (pack !== undefined && !reported && levelDone(session)) {
      reported = true;
      pack.onDone(); // pauses this game, usually: then no next frame
    }
    if (frameId === null) return;
    frameId = requestAnimationFrame(frame);
  };

  return {
    resume() {
      if (frameId !== null) return;
      // Sized on every resume: a shared level and the bundled one share the play canvas.
      // After the mode buttons show, as "fit" makes room for them.
      showPlayers();
      fit();
      window.addEventListener("resize", fit);
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
      window.removeEventListener("resize", fit);
      for (const m of PLAY_MODES) els.buttons[m].removeEventListener("click", onChoose[m]);
      held = new Set();
    },
    relabel() {
      hudText = null;
    },
    refit() {
      if (frameId !== null) fit();
    },
  };
}

const editorGrid = byId("editor-grid", HTMLCanvasElement);
const editorHint = byId("editor-hint", HTMLParagraphElement);

// The level being edited lives as long as the page, across visits to other screens.
const editor = createEditorView(
  {
    canvas: editorGrid,
    palette: byId("editor-palette", HTMLDivElement),
    name: byId("editor-name", HTMLInputElement),
    world: byId("editor-world", HTMLSelectElement),
    night: byId("editor-night", HTMLInputElement),
    width: byId("editor-width", HTMLInputElement),
    height: byId("editor-height", HTMLInputElement),
    undo: byId("editor-undo", HTMLButtonElement),
    redo: byId("editor-redo", HTMLButtonElement),
    test: byId("editor-test", HTMLButtonElement),
    errors: byId("editor-errors", HTMLDivElement),
    errorList: byId("editor-error-list", HTMLUListElement),
    labels: {
      name: byId("editor-name-label", HTMLSpanElement),
      world: byId("editor-world-label", HTMLSpanElement),
      night: byId("editor-night-label", HTMLSpanElement),
      width: byId("editor-width-label", HTMLSpanElement),
      height: byId("editor-height-label", HTMLSpanElement),
      hint: editorHint,
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
    // "Fit" keeps the bar, palette, grid and hint in view; "My levels" and the settings
    // below scroll, or a long list of levels would shrink the grid to nothing.
    widthFor: (logical) => gameWidth(gameSize, logical, roomFor(editorGrid, editorHint)),
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

/** The bundled packs (B-051), each level parsed; a broken one (a bug: tests parse them all) is left out. */
const packs = PACKS.map((pack) => ({
  pack,
  levels: pack.levels.flatMap((entry) => {
    const r = parseLevel(entry.text);
    if (r.ok) return [{ entry, level: r.level, key: progressKey(pack, entry) }];
    console.error(`Bundled level ${progressKey(pack, entry)} is invalid`, r.errors);
    return [];
  }),
})).filter((p) => p.levels.length > 0);
const packKeys = packs.flatMap((p) => p.levels.map((l) => l.key));
let progress: Progress = readProgress(browserStorage(), packKeys);
/** The pack and level on the play screen: the one played last, else the first. */
let packIndex = Math.max(
  0,
  packs.findIndex((p) => p.levels.some((l) => l.key === progress.current)),
);
let levelIndex = Math.max(
  0,
  packs[packIndex]?.levels.findIndex((l) => l.key === progress.current) ?? 0,
);
/** The game of that level, on the play screen; null when there is no pack. */
let game: Game | null = null;

function remember(next: Progress): void {
  progress = next;
  saveProgress(browserStorage(), progress); // not remembered when refused; play goes on
}

/** Starts level `index` of pack `p` from its beginning, in place of the current game. */
function playPackLevel(p: number, index: number): void {
  const pack: Pack | undefined = packs[p]?.pack;
  const chosen = packs[p]?.levels[index];
  if (pack === undefined || chosen === undefined) return;
  packIndex = p;
  levelIndex = index;
  remember({ ...progress, current: chosen.key });
  const wasPlaying = playing !== null && playing === game;
  game?.pause();
  game = createGame(canvas, playPlayers, chosen.level, showMessage, {
    title: () => translate(locale, chosen.entry.title),
    onDone: () => {
      remember(markDone(progress, chosen.key, packKeys));
      playPackLevel(p, nextIndex(index, pack.levels.length));
    },
    modes: packModes(pack),
    start: packStartMode(pack, chosen.entry, picked),
  });
  renderPack();
  if (wasPlaying) {
    playing = game;
    game.resume();
  }
}

function option(value: number, text: string, selected: boolean): HTMLOptionElement {
  const el = document.createElement("option");
  el.value = String(value);
  el.textContent = text;
  el.selected = selected;
  return el;
}

/** The pack and level lists above the game: number, title, and a tick for each level won. */
function renderPack(): void {
  packChoice.replaceChildren(
    ...packs.map(({ pack }, i) => option(i, translate(locale, pack.title), i === packIndex)),
  );
  packSelect.replaceChildren(
    ...(packs[packIndex]?.levels ?? []).map(({ entry, key }, i) =>
      option(
        i,
        translate(locale, progress.done.includes(key) ? "packOptionDone" : "packOption")
          .replace("{n}", () => String(i + 1))
          .replace("{name}", () => translate(locale, entry.title)),
        i === levelIndex,
      ),
    ),
  );
}

packChoice.addEventListener("change", () => {
  const p = Number(packChoice.value);
  // Keys go to the game, not to the list.
  packChoice.blur();
  if (!Number.isInteger(p)) return;
  // Back where this pack was left: its first level not won yet, else its first.
  const levels = packs[p]?.levels ?? [];
  playPackLevel(
    p,
    Math.max(
      0,
      levels.findIndex((l) => !progress.done.includes(l.key)),
    ),
  );
});

packSelect.addEventListener("change", () => {
  const index = Number(packSelect.value);
  packSelect.blur();
  if (Number.isInteger(index)) playPackLevel(packIndex, index);
});

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

if (packs.length === 0) messageKey = "levelError";
else playPackLevel(packIndex, levelIndex);

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
  packBar.hidden = route.screen !== "play" || game === null;
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
