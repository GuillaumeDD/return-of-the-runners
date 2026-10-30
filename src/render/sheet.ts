/**
 * The game's sprite sheet: every sprite drawn in code (`render/art/`), built once per
 * scale, in the browser.
 */
import { type ActorKind, MONK_ANIMS, RUNNER_ANIMS } from "./actors";
import { BOX, drawActorFrame } from "./art/actors";
import { ACTOR_TOP, TILE_PX } from "./canvas";
import * as tiles from "./art/tiles";
import {
  buildSheet,
  DUG_STAGES,
  frameKey,
  SLAB_VARIANTS,
  slabKey,
  type SpriteDef,
  type SpriteSheet,
  type Surface,
} from "./sprites";

/** An actor sprite: one tile wide, with headroom above its cell (`BOX`). */
export const ACTOR_SPRITE = {
  width: TILE_PX,
  height: (TILE_PX * BOX.height) / BOX.width,
  /** How far above its cell an actor sprite starts: `ACTOR_TOP`. */
  top: ACTOR_TOP,
} as const;

function actorSprites(): SpriteDef[] {
  const defs: SpriteDef[] = [];
  const add = (
    kind: ActorKind,
    anims: Readonly<Record<string, { name: string; frames: number; fps: number }>>,
  ): void => {
    for (const [action, anim] of Object.entries(anims)) {
      for (let f = 0; f < anim.frames; f++) {
        defs.push({
          key: `${kind}/${frameKey(anim, f)}`,
          width: ACTOR_SPRITE.width,
          height: ACTOR_SPRITE.height,
          draw: (ctx) => {
            ctx.scale(TILE_PX / BOX.width, TILE_PX / BOX.width);
            // `action` comes from the keys of the animation tables.
            drawActorFrame(ctx, kind, action as keyof typeof MONK_ANIMS, f, anim.frames);
          },
        });
      }
    }
  };
  add("runner1", RUNNER_ANIMS);
  add("runner2", RUNNER_ANIMS);
  add("monk", MONK_ANIMS);
  return defs;
}

/** A one-tile sprite drawn in the 32-unit cell of `render/art/`. */
function tile(key: string, draw: (ctx: CanvasRenderingContext2D) => void): SpriteDef {
  return {
    key,
    width: TILE_PX,
    height: TILE_PX,
    draw: (ctx) => {
      ctx.scale(TILE_PX / 32, TILE_PX / 32);
      draw(ctx);
    },
  };
}

function tileSprites(): SpriteDef[] {
  const defs: SpriteDef[] = [];
  for (const slab of ["soft", "hard"] as const) {
    for (let mask = 0; mask < tiles.MASKS; mask++) {
      for (let v = 0; v < SLAB_VARIANTS; v++) {
        defs.push(
          tile(slabKey(`slab:${slab}`, mask, v), (c) => {
            tiles.drawSlab(c, slab, mask, v);
          }),
        );
      }
    }
    for (let k = 1; k < DUG_STAGES; k++) {
      defs.push(
        tile(`dug:${slab}:${String(k)}`, (c) => {
          tiles.drawDugSlab(c, slab, k / DUG_STAGES);
        }),
      );
    }
  }
  defs.push(
    tile("goo-coat", tiles.drawGooCoat),
    tile("ladder", tiles.drawLadder),
    tile("bar", tiles.drawBar),
    tile("gold", (c) => {
      tiles.drawGold(c);
    }),
    tile("gold:plain", (c) => {
      tiles.drawGold(c, false);
    }),
    tile("exit", tiles.drawExit),
    tile("alcove", tiles.drawAlcove),
    tile("teleport:in", (c) => {
      tiles.drawTeleporter(c, true);
    }),
    tile("teleport:out", (c) => {
      tiles.drawTeleporter(c, false);
    }),
    tile("jackhammer", tiles.drawJackhammer),
    tile("pickaxe", tiles.drawPickaxe),
    tile("bomb:small", (c) => {
      tiles.drawBomb(c, false);
    }),
    tile("bomb:big", (c) => {
      tiles.drawBomb(c, true);
    }),
    tile("snare", tiles.drawSnare),
    tile("gas-spray", tiles.drawGasSpray),
    tile("goo-bucket", tiles.drawGooBucket),
  );
  for (const k of ["a", "b", "c"] as const) {
    defs.push(
      tile(`key:${k}`, (c) => {
        tiles.drawKey(c, k);
      }),
    );
    defs.push(
      tile(`door:${k}`, (c) => {
        tiles.drawDoor(c, k);
      }),
    );
  }
  return defs;
}

/** Every sprite of the game. */
export const SPRITES: readonly SpriteDef[] = [...tileSprites(), ...actorSprites()];

/** A surface backed by a DOM canvas; null where the browser has no 2D canvas. */
export const domSurface: Surface = (width, height) => {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  return ctx === null ? null : { image: c, ctx };
};

/** Sheets by scale: a canvas moved to another screen gets its own, drawn once. */
const sheets = new Map<number, SpriteSheet>();

export function sheetAt(scale: number): SpriteSheet {
  let sheet = sheets.get(scale);
  if (sheet === undefined) {
    sheet = buildSheet(SPRITES, scale, domSurface);
    sheets.set(scale, sheet);
  }
  return sheet;
}
