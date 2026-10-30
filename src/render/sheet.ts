/**
 * The game's sprite sheet: every sprite drawn in code (`render/art/`), built once per
 * scale, in the browser.
 */
import { type ActorKind, MONK_ANIMS, RUNNER_ANIMS } from "./actors";
import { BOX, drawActorFrame } from "./art/actors";
import { ACTOR_TOP, TILE_PX } from "./canvas";
import { buildSheet, frameKey, type SpriteDef, type SpriteSheet, type Surface } from "./sprites";

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

/** Every sprite of the game. */
export const SPRITES: readonly SpriteDef[] = actorSprites();

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
