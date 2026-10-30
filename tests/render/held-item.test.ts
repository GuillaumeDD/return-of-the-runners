import { describe, expect, it } from "vitest";
import { render } from "../../src/render/canvas";
import { SPRITES } from "../../src/render/sheet";
import type { SpriteSheet } from "../../src/render/sprites";
import type { Player } from "../../src/sim/state";
import { stateFrom, withPlayer } from "../sim/helpers";

const KEYS = SPRITES.map((s) => s.key);

/** A sheet with every sprite; a frame's sx is its index, so draws map back to keys. */
const SHEET: SpriteSheet = {
  scale: 1,
  image: {} as CanvasImageSource,
  frames: new Map(KEYS.map((k, i) => [k, { sx: i, sy: 0, sw: 24, sh: 24, width: 24, height: 24 }])),
};

/** Records the opacity each sprite and each filled rectangle is drawn with. */
function recorder(): {
  ctx: CanvasRenderingContext2D;
  sprites: Map<string, number>;
  fills: number[];
} {
  const sprites = new Map<string, number>();
  const fills: number[] = [];
  const target: Record<string, unknown> = {
    globalAlpha: 1,
    fillStyle: "",
    drawImage(_img: unknown, sx: number) {
      sprites.set(KEYS[sx] ?? "?", target.globalAlpha as number);
    },
    fillRect() {
      fills.push(target.globalAlpha as number);
    },
  };
  const ctx = new Proxy(target, {
    get(t, p: string) {
      return p in t ? t[p] : () => undefined;
    },
    set(t, p: string, v: unknown) {
      t[p] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, sprites, fills };
}

function holding(item: Player["item"], hidden: boolean, sheet?: SpriteSheet) {
  const s = withPlayer(stateFrom(["..P.", "####"]), { item, hidden });
  const r = recorder();
  render(r.ctx, s, sheet);
  return r;
}

describe("the item in a player's hand", () => {
  it("is drawn in shadow, like the runner, while the runner hides (B-043)", () => {
    for (const item of ["a", "j", "k", "s", "g", "u"] as const) {
      const { sprites } = holding(item, true, SHEET);
      const art = [...sprites].filter(([k]) => !k.startsWith("runner") && !k.startsWith("slab"));
      expect(art.length).toBeGreaterThan(0);
      for (const [, alpha] of art) expect(alpha).toBeLessThan(1);
      const runner = [...sprites].find(([k]) => k.startsWith("runner"));
      expect(art[0]?.[1]).toBe(runner?.[1]);
    }
  });

  it("is drawn fully opaque when the runner is not hiding", () => {
    const { sprites } = holding("k", false, SHEET);
    for (const [, alpha] of sprites) expect(alpha).toBe(1);
  });

  it("is in shadow too without art (placeholder shapes)", () => {
    const shown = holding("k", false).fills.length;
    const { fills } = holding("k", true);
    expect(fills.slice(-2).every((a) => a < 1)).toBe(true);
    expect(fills.length).toBe(shown);
  });
});
