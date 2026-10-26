import { parseRoute, type Route } from "./app/route";
import { newEditor } from "./editor/model";
import { createEditorView } from "./editor/view";
import { advance, type Accumulator } from "./game/loop";
import { createSession, tickSession, type Session } from "./game/session";
import { detectLocale, translate, type Locale, type MessageKey } from "./i18n";
import { inputFrom, isBound, keyDown, keyUp, type HeldKeys } from "./input/keyboard";
import { parseLevel } from "./level/parse";
import firstSteps from "./levels/first-steps.json?raw";
import { canvasSize, context2d, render } from "./render/canvas";
import { createState, type GameState, type Status } from "./sim/state";

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
const ctx = context2d(canvas);

let locale: Locale = detectLocale(navigator.languages);
let messageKey: MessageKey = "controls";

const STATUS_MESSAGE: Readonly<Record<Status, MessageKey>> = {
  playing: "controls",
  dead: "caught",
  won: "won",
};

function renderText(): void {
  document.documentElement.lang = locale;
  document.title = translate(locale, "title");
  title.textContent = translate(locale, "title");
  subtitle.textContent = translate(locale, "subtitle");
  message.textContent = translate(locale, messageKey);
  langButton.textContent = translate(locale, "switchLanguage");
  navPlay.textContent = translate(locale, "navPlay");
  navEdit.textContent = translate(locale, "navEdit");
  editor.setLocale(locale);
}

langButton.addEventListener("click", () => {
  locale = locale === "en" ? "fr" : "en";
  renderText();
});

/** The play screen's game: runs only while that screen is shown. */
interface Game {
  readonly resume: () => void;
  readonly pause: () => void;
}

function createGame(context: CanvasRenderingContext2D, initial: GameState): Game {
  let session: Session = createSession(initial);
  let held: HeldKeys = new Set();
  let acc: Accumulator = { carry: 0 };
  let last: number | null = null;
  let frameId: number | null = null;

  const size = canvasSize(initial);
  canvas.width = size.width;
  canvas.height = size.height;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isBound(e.code)) e.preventDefault(); // arrows must not scroll the page
    held = keyDown(held, e.code);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    held = keyUp(held, e.code);
  };
  // Releasing a key while the window is unfocused never fires keyup: clear everything.
  const onBlur = (): void => {
    held = new Set();
  };

  const frame = (now: number): void => {
    const result = advance(acc, last === null ? 0 : now - last);
    last = now;
    acc = result.acc;
    const input = inputFrom(held);
    for (let i = 0; i < result.ticks; i++) session = tickSession(session, input);
    const key = STATUS_MESSAGE[session.state.status];
    if (key !== messageKey) {
      messageKey = key;
      renderText();
    }
    render(context, session.state);
    frameId = requestAnimationFrame(frame);
  };

  return {
    resume() {
      if (frameId !== null) return;
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
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
      held = new Set();
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
    labels: {
      name: byId("editor-name-label", HTMLSpanElement),
      width: byId("editor-width-label", HTMLSpanElement),
      height: byId("editor-height-label", HTMLSpanElement),
      hint: byId("editor-hint", HTMLParagraphElement),
    },
  },
  newEditor(translate(locale, "defaultLevelName")),
  locale,
);

let game: Game | null = null;
const parsed = parseLevel(firstSteps);
if (parsed.ok) {
  game = createGame(ctx, createState(parsed.level, 1));
} else {
  messageKey = "levelError";
  console.error("Bundled level is invalid", parsed.errors);
}

const TABS: readonly (readonly [HTMLAnchorElement, Route["screen"]])[] = [
  [navPlay, "play"],
  [navEdit, "edit"],
];

function show(route: Route): void {
  // Shared levels play the bundled level until share links land (B-017).
  const editing = route.screen === "edit";
  playScreen.hidden = editing;
  editScreen.hidden = !editing;
  // A shared level is neither tab.
  for (const [link, screen] of TABS) {
    if (screen === route.screen) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (editing) {
    game?.pause();
    editor.show();
  } else {
    editor.hide();
    game?.resume();
  }
}

window.addEventListener("hashchange", () => {
  show(parseRoute(location.hash));
});
renderText();
show(parseRoute(location.hash));
