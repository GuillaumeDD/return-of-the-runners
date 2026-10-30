/** B-030 mockups: `index.html?style=diorama&world=moss` draws one picture. */
import { H, type Style, W, type World } from "./common";
import { renderDiorama } from "./diorama";
import { renderGlow } from "./glow";
import { renderPixel } from "./pixel";

const params = new URLSearchParams(location.search);
const style = (params.get("style") ?? "diorama") as Style;
const world = (params.get("world") ?? "moss") as World;
const scale = Number(params.get("scale") ?? "1");

const el = document.getElementById("mockup");
if (!(el instanceof HTMLCanvasElement)) throw new Error("no canvas");
el.width = W * scale;
el.height = H * scale;
el.style.width = `${String(W)}px`;
const ctx = el.getContext("2d");
if (ctx === null) throw new Error("no 2d context");
ctx.scale(scale, scale);
if (style === "pixel") renderPixel(ctx, world);
else if (style === "glow") renderGlow(ctx, world);
else renderDiorama(ctx, world);
document.body.dataset["done"] = "1";
