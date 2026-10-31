import { describe, expect, it } from "vitest";
import { playerPanels } from "../../src/game/hud";
import { translate } from "../../src/i18n";
import { BAR, drawFrame, drawHud, fitText, FRAME, frameLayout } from "../../src/render/hud";
import { tileArt, type SpriteSheet } from "../../src/render/sprites";
import { START_LIVES } from "../../src/sim/rules";
import { stateFrom, withPlayer } from "../sim/helpers";

/**
 * A fake 2D context: logs the text drawn, the sprites drawn (by the frame's key, from a
 * fake sheet) and every other call; text is 7 logical pixels a character.
 */
function recorder(): {
  ctx: CanvasRenderingContext2D;
  texts: string[];
  sprites: string[];
  calls: string[];
} {
  const texts: string[] = [];
  const sprites: string[] = [];
  const calls: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {
    createLinearGradient: () => gradient,
    fillText: (t: string) => texts.push(t),
    measureText: (t: string) => ({ width: Array.from(t).length * 7 }),
    drawImage: (img: { key: string }) => sprites.push(img.key),
  };
  const ctx = new Proxy(target, {
    get: (t, p: string) =>
      p in t
        ? t[p]
        : () => {
            calls.push(p);
          },
    set: () => true,
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts, sprites, calls };
}

/** A sheet whose every frame draws its own key, so the recorder can tell them apart. */
function fakeSheet(keys: readonly string[]): SpriteSheet {
  const frames = new Map(
    keys.map((k) => [k, { sx: 0, sy: 0, sw: 1, sh: 1, width: 24, height: 24 }]),
  );
  // drawSprite passes the sheet image: one image per call is enough to log the key.
  let current = "";
  const image = new Proxy({}, { get: (_, p) => (p === "key" ? current : undefined) });
  return {
    scale: 1,
    image: image as CanvasImageSource,
    frames: new Proxy(frames, {
      get(t, p) {
        if (p === "get") {
          return (k: string) => {
            current = k;
            return t.get(k);
          };
        }
        const v: unknown = Reflect.get(t, p, t);
        return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
      },
    }),
  };
}

const NO_ART: SpriteSheet = { scale: 1, image: null, frames: new Map() };
const rows = ["P......Q", "########"];

describe("frameLayout", () => {
  it("frames the playfield on three sides and puts the bar under it", () => {
    const l = frameLayout({ width: 672, height: 384 });
    expect(l.width).toBe(672 + 2 * FRAME);
    expect(l.height).toBe(FRAME + 384 + BAR);
    expect(l.field).toEqual({ x: FRAME, y: FRAME, width: 672, height: 384 });
    expect(l.barMiddle).toBe(FRAME + 384 + BAR / 2);
    // Half a tile: the playfield starts on a whole device pixel at every even tile size.
    expect(FRAME * 2).toBe(24);
  });

  it("draws the frame without text or sprites", () => {
    const { ctx, texts, sprites, calls } = recorder();
    drawFrame(ctx, frameLayout({ width: 192, height: 192 }));
    expect(texts).toEqual([]);
    expect(sprites).toEqual([]);
    expect(calls).toContain("fillRect");
  });
});

describe("playerPanels", () => {
  it("reads each player's lives, gold, item, bombs and whether it is out", () => {
    let s = stateFrom(rows, 1, 2);
    s = withPlayer(s, { gold: 4, item: "k", bombs: "Oo" }, 0);
    s = withPlayer(s, { mode: "out", lives: 0 }, 1);
    expect(playerPanels(s)).toEqual([
      { lives: START_LIVES, gold: 4, item: "k", bombs: "Oo", out: false },
      { lives: 0, gold: 0, item: "", bombs: "", out: true },
    ]);
    expect(playerPanels(stateFrom(rows))).toHaveLength(1);
  });
});

describe("drawHud", () => {
  const layout = frameLayout({ width: 672, height: 384 });
  const keys = [
    "runner1/idle:0",
    "runner2/idle:0",
    "gold:plain",
    "pickaxe",
    "bomb:small",
    "bomb:big",
  ];

  it("shows both players' counters and the level's name, from the state", () => {
    let s = stateFrom(rows, 1, 2);
    s = withPlayer(s, { gold: 4, lives: 2, item: "k", bombs: "Oo" }, 0);
    s = withPlayer(s, { gold: 1, bombs: "o" }, 1);
    const { ctx, texts, sprites } = recorder();
    drawHud(ctx, layout, fakeSheet(keys), "en", playerPanels(s), "First steps");
    expect(texts).toEqual(["×2", "4", "2", `×${String(START_LIVES)}`, "1", "1", "First steps"]);
    // Runner, gold, item, next bomb; then player 2 without an item.
    expect(sprites).toEqual([
      "runner1/idle:0",
      "gold:plain",
      tileArt("k"),
      tileArt("O"),
      "runner2/idle:0",
      "gold:plain",
      tileArt("o"),
    ]);
  });

  it("draws one player alone, with the name in the space left", () => {
    const { ctx, texts } = recorder();
    drawHud(ctx, layout, fakeSheet(keys), "en", playerPanels(stateFrom(rows)), "Solo");
    expect(texts).toEqual([`×${String(START_LIVES)}`, "0", "0", "Solo"]);
  });

  it("marks a player who is out, translated", () => {
    const s = withPlayer(stateFrom(rows, 1, 2), { mode: "out", lives: 0 }, 1);
    for (const locale of ["en", "fr"] as const) {
      const { ctx, texts } = recorder();
      drawHud(ctx, layout, NO_ART, locale, playerPanels(s), "x");
      expect(texts).toContain(translate(locale, "hudOutTag"));
    }
    expect(translate("en", "hudOutTag")).toBe("OUT");
    expect(translate("fr", "hudOutTag")).toBe("ÉLIMINÉ");
  });

  it("still shows every number without art, with an item's letter in its slot", () => {
    const s = withPlayer(stateFrom(rows), { item: "k", bombs: "o" });
    const { ctx, texts, sprites } = recorder();
    drawHud(ctx, layout, NO_ART, "en", playerPanels(s), "x");
    expect(sprites).toEqual([]);
    expect(texts).toEqual([`×${String(START_LIVES)}`, "0", "k", "1", "x"]);
  });

  it("shortens a long name to fit between the players, between graphemes", () => {
    const { ctx, texts } = recorder();
    const s = stateFrom(rows, 1, 2);
    const long = "é".repeat(64);
    drawHud(ctx, layout, NO_ART, "en", playerPanels(s), long);
    const shown = texts.at(-1) ?? "";
    expect(shown.endsWith("…")).toBe(true);
    expect(Array.from(shown).length).toBeLessThan(64);
    expect(fitText(ctx, "short", 100)).toBe("short");
    // A skin-toned thumb is two code points (14 px here): it is kept whole or dropped whole.
    expect(fitText(ctx, "👍🏽👍🏽👍🏽", 21)).toBe("👍🏽…");
    expect(fitText(ctx, "👍🏽👍🏽👍🏽", 20)).toBe("…");
  });
});
