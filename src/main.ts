import { advance, type Accumulator } from "./game/loop";
import { createSession, tickSession, type Session } from "./game/session";
import { detectLocale, translate, type Locale, type MessageKey } from "./i18n";
import { inputFrom, isBound, keyDown, keyUp, type HeldKeys } from "./input/keyboard";
import { parseLevel } from "./level/parse";
import firstSteps from "./levels/first-steps.json?raw";
import { canvasSize, render } from "./render/canvas";
import { createState, type GameState } from "./sim/state";

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
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D is not available");

let locale: Locale = detectLocale(navigator.languages);
let messageKey: MessageKey = "controls";

function renderText(): void {
  document.documentElement.lang = locale;
  document.title = translate(locale, "title");
  title.textContent = translate(locale, "title");
  subtitle.textContent = translate(locale, "subtitle");
  message.textContent = translate(locale, messageKey);
  langButton.textContent = translate(locale, "switchLanguage");
}

langButton.addEventListener("click", () => {
  locale = locale === "en" ? "fr" : "en";
  renderText();
});

const parsed = parseLevel(firstSteps);
if (!parsed.ok) {
  messageKey = "levelError";
  renderText();
  console.error("Bundled level is invalid", parsed.errors);
} else {
  renderText();
  start(ctx, createState(parsed.level, 1));
}

function start(context: CanvasRenderingContext2D, initial: GameState): void {
  let session: Session = createSession(initial);
  let held: HeldKeys = new Set();
  let acc: Accumulator = { carry: 0 };
  let last: number | null = null;

  const size = canvasSize(initial);
  canvas.width = size.width;
  canvas.height = size.height;

  window.addEventListener("keydown", (e) => {
    if (isBound(e.code)) e.preventDefault(); // arrows must not scroll the page
    held = keyDown(held, e.code);
  });
  window.addEventListener("keyup", (e) => {
    held = keyUp(held, e.code);
  });
  // Releasing a key while the window is unfocused never fires keyup: clear everything.
  window.addEventListener("blur", () => {
    held = new Set();
  });

  const frame = (now: number): void => {
    const result = advance(acc, last === null ? 0 : now - last);
    last = now;
    acc = result.acc;
    const input = inputFrom(held);
    for (let i = 0; i < result.ticks; i++) session = tickSession(session, input);
    const key: MessageKey = session.state.status === "dead" ? "caught" : "controls";
    if (key !== messageKey) {
      messageKey = key;
      renderText();
    }
    render(context, session.state);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
