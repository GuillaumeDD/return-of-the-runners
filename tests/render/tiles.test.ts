import { describe, expect, it } from "vitest";
import { brickLeft, render, renderGrid } from "../../src/render/canvas";
import { emblemPath } from "../../src/render/art/tiles";
import { SPRITES } from "../../src/render/sheet";
import { DUG_STAGES, dugStage, type SpriteSheet } from "../../src/render/sprites";
import { cellSprite, SIDE, slabMask, slabOf, slabVariant } from "../../src/render/terrain";
import { HOLE_TICKS } from "../../src/sim/rules";
import { stateFrom } from "../sim/helpers";

const KEYS = SPRITES.map((s) => s.key);

/** A sheet with every sprite, each frame's sx being its index, so draws map back to keys. */
const FAKE_SHEET: SpriteSheet = {
  scale: 1,
  image: {} as CanvasImageSource,
  frames: new Map(KEYS.map((k, i) => [k, { sx: i, sy: 0, sw: 24, sh: 24, width: 24, height: 24 }])),
};

/** A context that records which sprites it drew where, and every fillRect; the rest no-ops. */
function recorder(): {
  ctx: CanvasRenderingContext2D;
  sprites: string[];
  calls: string[];
} {
  const sprites: string[] = [];
  const calls: string[] = [];
  const target: Record<string, unknown> = {
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    drawImage(
      _img: unknown,
      sx: number,
      _sy: number,
      _sw: number,
      _sh: number,
      x: number,
      y: number,
    ) {
      sprites.push(`${KEYS[sx] ?? "?"}@${String(x)},${String(y)}`);
    },
    fillRect(x: number, y: number) {
      calls.push(`fillRect@${String(x)},${String(y)}`);
    },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 0 }),
  };
  const ctx = new Proxy(target, {
    get(t, p: string) {
      if (p in t) return t[p];
      return (...args: unknown[]) => {
        calls.push(`${p}(${args.length.toString()})`);
      };
    },
    set(t, p: string, v: unknown) {
      t[p] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, sprites, calls };
}

describe("dugStage", () => {
  it("is 0 for nothing left, DUG_STAGES for a whole brick, and at least 1 for any brick", () => {
    expect(dugStage(0)).toBe(0);
    expect(dugStage(-0.5)).toBe(0);
    expect(dugStage(Number.NaN)).toBe(0);
    expect(dugStage(1)).toBe(DUG_STAGES);
    expect(dugStage(1e-6)).toBe(1);
    expect(dugStage(0.25)).toBe(1);
    expect(dugStage(0.26)).toBe(2);
    expect(dugStage(0.5)).toBe(2);
    expect(dugStage(0.75)).toBe(3);
    expect(dugStage(0.99)).toBe(DUG_STAGES);
  });

  it("never goes up while digging and never down while closing, and shows every stage both ways", () => {
    const dig = HOLE_TICKS.digging;
    const shut = dig + HOLE_TICKS.open;
    const end = shut + HOLE_TICKS.closing;
    const digging: number[] = [];
    for (let age = 0; age < dig; age++) digging.push(dugStage(brickLeft(age)));
    const closing: number[] = [];
    for (let age = shut; age <= end; age++) closing.push(dugStage(brickLeft(age)));
    for (let i = 1; i < digging.length; i++)
      expect(digging[i]).toBeLessThanOrEqual(digging[i - 1] ?? 0);
    for (let i = 1; i < closing.length; i++)
      expect(closing[i]).toBeGreaterThanOrEqual(closing[i - 1] ?? 0);
    for (let s = 1; s < DUG_STAGES; s++) {
      expect(digging).toContain(s);
      expect(closing).toContain(s);
    }
    expect(dugStage(brickLeft(dig))).toBe(0); // fully open
  });

  it("has a sprite for every partial stage of both slabs", () => {
    for (const slab of ["soft", "hard"])
      for (let s = 1; s < DUG_STAGES; s++) expect(KEYS).toContain(`dug:${slab}:${String(s)}`);
  });
});

describe("slabOf and slabMask", () => {
  it("joins brick, trapdoor turf and gooey turf into one slab, bedrock into another", () => {
    expect(slabOf("#")).toBe("soft");
    expect(slabOf("%")).toBe("soft");
    expect(slabOf("~")).toBe("soft");
    expect(slabOf("@")).toBe("hard");
    for (const t of [".", "H", "-", "$", "E", "n", "A", ""]) expect(slabOf(t)).toBeNull();
  });

  it("gives an isolated cell mask 0, and sets one bit per neighbour that continues the slab", () => {
    expect(slabMask(["...", ".#.", "..."], 1, 1)).toBe(0);
    expect(slabMask([".#.", ".#.", "..."], 1, 1)).toBe(SIDE.up);
    expect(slabMask(["...", ".##", "..."], 1, 1)).toBe(SIDE.right);
    expect(slabMask(["...", ".#.", ".#."], 1, 1)).toBe(SIDE.down);
    expect(slabMask(["...", "##.", "..."], 1, 1)).toBe(SIDE.left);
    expect(slabMask([".%.", "~#@", "..."], 1, 1)).toBe(SIDE.up | SIDE.left);
  });

  it("does not join brick and bedrock", () => {
    expect(slabMask(["...", "@#@", "..."], 1, 1)).toBe(0);
    expect(slabMask(["...", "#@#", "..."], 1, 1)).toBe(0);
  });

  it("counts outside the grid as continuing the slab", () => {
    expect(slabMask(["#"], 0, 0)).toBe(15);
    expect(slabMask(["#.", ".."], 0, 0)).toBe(SIDE.up | SIDE.left);
  });

  it("alternates two texture variants along a row and down a column", () => {
    expect(slabVariant(0, 0)).not.toBe(slabVariant(1, 0));
    expect(slabVariant(0, 0)).toBe(slabVariant(0, 1));
    expect([0, 1]).toContain(slabVariant(7, 3));
  });
});

describe("cellSprite", () => {
  it("draws trapdoor and gooey turf with the brick's slab sprite, so play cannot tell them apart", () => {
    const rows = ["#%~#", "@@@@"];
    const brick = cellSprite(["####", "@@@@"], 1, 0);
    expect(cellSprite(rows, 1, 0)).toBe(brick);
    expect(cellSprite(["####", "@@@@"], 2, 0)).toBe(cellSprite(rows, 2, 0));
  });

  it("is a key of the sheet for every tile with art, and null for an empty cell", () => {
    const rows = ["#H-$E.nTt", "abcABCjko", "Osgu@%~h."];
    for (let cy = 0; cy < rows.length; cy++)
      for (let cx = 0; cx < (rows[cy]?.length ?? 0); cx++) {
        const key = cellSprite(rows, cx, cy);
        if (key !== null) expect(KEYS).toContain(key);
      }
    expect(cellSprite(rows, 5, 0)).toBeNull();
  });

  it("gives keys and doors a distinct sprite per colour", () => {
    const keys = ["a", "b", "c", "A", "B", "C"].map((t) => cellSprite([t], 0, 0));
    expect(new Set(keys).size).toBe(6);
  });
});

describe("emblemPath", () => {
  it("traces a different shape for each key colour (circle, square, triangle)", () => {
    const shapes = (["a", "b", "c"] as const).map((k) => {
      const { ctx, calls } = recorder();
      emblemPath(ctx, k, 10, 10, 4);
      return calls.join(" ");
    });
    expect(shapes[0]).toContain("arc(");
    expect(shapes[1]).toContain("rect(");
    expect(shapes[2]).toContain("lineTo(");
    expect(new Set(shapes).size).toBe(3);
  });
});

describe("tile art in play and in the editor", () => {
  it("marks trapdoor turf in the editor only, over the same sprite as brick", () => {
    const brick = recorder();
    renderGrid(brick.ctx, ["#"], [], null, FAKE_SHEET);
    const trap = recorder();
    renderGrid(trap.ctx, ["%"], [], null, FAKE_SHEET);
    expect(trap.sprites).toEqual(brick.sprites);
    expect(trap.calls.length).toBeGreaterThan(brick.calls.length);

    const playBrick = recorder();
    render(playBrick.ctx, stateFrom(["#.P"]), FAKE_SHEET);
    const playTrap = recorder();
    render(playTrap.ctx, stateFrom(["%.P"]), FAKE_SHEET);
    expect(playTrap.sprites).toEqual(playBrick.sprites);
    expect(playTrap.calls).toEqual(playBrick.calls);
  });

  it("hides a hidden ladder and a closed exit in play, but shows both in the editor", () => {
    const play = recorder();
    render(play.ctx, stateFrom(["hE$P"]), FAKE_SHEET);
    expect(play.sprites.some((s) => s.startsWith("ladder@"))).toBe(false);
    expect(play.sprites.some((s) => s.startsWith("exit@"))).toBe(false);

    const editor = recorder();
    renderGrid(editor.ctx, ["hE$"], [], null, FAKE_SHEET);
    expect(editor.sprites).toContain("ladder@0,0");
    expect(editor.sprites).toContain("exit@24,0");
  });

  it("shows the exit once all the gold is taken", () => {
    const open = recorder();
    render(open.ctx, stateFrom(["E.P"]), FAKE_SHEET);
    expect(open.sprites).toContain("exit@0,0");
  });

  it("coats gooey turf with the goo sprite, over the slab", () => {
    const { ctx, sprites } = recorder();
    render(ctx, stateFrom(["~.P"]), FAKE_SHEET);
    const here = sprites.filter((s) => s.endsWith("@0,0")).map((s) => s.split("@")[0]);
    expect(here).toEqual([cellSprite(["~.P"], 0, 0), "goo-coat"]);
  });
});
