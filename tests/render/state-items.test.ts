import { describe, expect, it } from "vitest";
import { render, TILE_PX } from "../../src/render/canvas";
import { SPRITES } from "../../src/render/sheet";
import type { SpriteSheet } from "../../src/render/sprites";
import { RUBBLE_TICKS, SUB } from "../../src/sim/rules";
import type { GameState } from "../../src/sim/state";
import { stateFrom } from "../sim/helpers";

const KEYS = SPRITES.map((s) => s.key);

/** A sheet with every sprite; a frame's sx is its index, so draws map back to keys. */
const SHEET: SpriteSheet = {
  scale: 1,
  image: {} as CanvasImageSource,
  frames: new Map(KEYS.map((k, i) => [k, { sx: i, sy: 0, sw: 24, sh: 24, width: 24, height: 24 }])),
};

/** Records each sprite drawn (key@x,y → opacity) and how many gradient fills ran. */
function recorder(): {
  ctx: CanvasRenderingContext2D;
  sprites: Map<string, number>;
  glows: () => number;
} {
  const sprites = new Map<string, number>();
  let glows = 0;
  const target: Record<string, unknown> = {
    globalAlpha: 1,
    fillStyle: "",
    drawImage(
      _i: unknown,
      sx: number,
      _sy: number,
      _sw: number,
      _sh: number,
      x: number,
      y: number,
    ) {
      sprites.set(`${KEYS[sx] ?? "?"}@${String(x)},${String(y)}`, target.globalAlpha as number);
    },
    fillRect() {
      if (typeof target.fillStyle === "object") glows++;
    },
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  const ctx = new Proxy(target, {
    get: (t, p: string) => (p in t ? t[p] : () => undefined),
    set(t, p: string, v: unknown) {
      t[p] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, sprites, glows: () => glows };
}

function drawn(patch: Partial<GameState>): ReturnType<typeof recorder> {
  const r = recorder();
  render(r.ctx, { ...stateFrom(["....P", "#####"]), ...patch }, SHEET);
  return r;
}

describe("items in play, with art (B-044)", () => {
  it("draws pickaxe rubble with its sprite, falling and landed", () => {
    const falling = drawn({ rubble: [{ cx: 1, y: 3, landed: -1 }] });
    expect(falling.sprites.get(`rubble@${String(TILE_PX)},${String(3 * (TILE_PX / SUB))}`)).toBe(1);
    const landed = drawn({ rubble: [{ cx: 1, y: 0, landed: 10 }] });
    expect(landed.sprites.get(`rubble@${String(TILE_PX)},0`)).toBe(1);
  });

  it("fades landed rubble over its last ticks, before it crumbles", () => {
    const late = drawn({ rubble: [{ cx: 1, y: 0, landed: RUBBLE_TICKS - 10 }] });
    const alpha = late.sprites.get(`rubble@${String(TILE_PX)},0`) ?? 1;
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
  });

  it("draws a laid snare with its own sprite, not the item's", () => {
    const { sprites } = drawn({ snares: [{ cx: 2, cy: 0 }] });
    expect(sprites.has(`snare:set@${String(2 * TILE_PX)},0`)).toBe(true);
    expect([...sprites.keys()].some((k) => k.startsWith("snare@"))).toBe(false);
  });

  it("draws a lit bomb with its sprite and a glowing spark on the fuse", () => {
    for (const big of [false, true]) {
      const { sprites, glows } = drawn({ fuses: [{ cx: 1, cy: 0, big, left: 100 }] });
      expect(sprites.has(`bomb:${big ? "big" : "small"}@${String(TILE_PX)},0`)).toBe(true);
      expect(glows()).toBeGreaterThan(0);
    }
  });
});
