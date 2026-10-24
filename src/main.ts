import { detectLocale, translate, type Locale } from "./i18n";

const canvas = document.querySelector<HTMLCanvasElement>("#screen");
const langButton = document.querySelector<HTMLButtonElement>("#lang");
const ctx = canvas?.getContext("2d");

if (!canvas || !langButton || !ctx) {
  throw new Error("Missing #screen canvas or #lang button");
}

let locale: Locale = detectLocale(navigator.languages);

function drawTitle(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = "#111";
  context.fillRect(0, 0, width, height);
  context.textAlign = "center";
  context.fillStyle = "#f2c94c";
  context.font = "bold 40px system-ui, sans-serif";
  context.fillText(translate(locale, "title"), width / 2, height / 2 - 30);
  context.fillStyle = "#bbb";
  context.font = "18px system-ui, sans-serif";
  context.fillText(translate(locale, "subtitle"), width / 2, height / 2 + 10);
  context.fillStyle = "#888";
  context.font = "16px system-ui, sans-serif";
  context.fillText(translate(locale, "pressKey"), width / 2, height / 2 + 60);
}

function render(): void {
  if (!canvas || !langButton || !ctx) return;
  document.documentElement.lang = locale;
  langButton.textContent = translate(locale, "switchLanguage");
  drawTitle(ctx, canvas.width, canvas.height);
}

langButton.addEventListener("click", () => {
  locale = locale === "en" ? "fr" : "en";
  render();
});

render();
