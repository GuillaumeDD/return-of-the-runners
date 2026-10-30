/**
 * Which animation an actor shows: a pure function of the simulation state and of a
 * small render-side record of when each actor last moved (`Motion`), to tell running
 * from standing still. Nothing here feeds back into the simulation. See
 * docs/ARCHITECTURE.md § Art direction.
 */
import { isFalling } from "../sim/move";
import { cellOf, isBar, isLadder, type Terrain } from "../sim/physics";
import { GOO_PERIOD, SUB } from "../sim/rules";
import type { Actor, GameState, Monk, Player } from "../sim/state";
import { type Animation, frameAt, frameKey } from "./sprites";

export type RunnerAction = "idle" | "run" | "climb" | "bar" | "fall" | "dig" | "drill" | "die";
export type MonkAction =
  "idle" | "run" | "climb" | "bar" | "fall" | "trapped" | "escaping" | "snared" | "dazed";
export type ActorKind = "runner1" | "runner2" | "monk";

function anim(name: string, frames: number, fps: number): Animation {
  return { name, frames, fps };
}

/** Frame counts and speeds, from the style guide (ARCHITECTURE § Art direction). */
export const RUNNER_ANIMS: Readonly<Record<RunnerAction, Animation>> = {
  idle: anim("idle", 1, 1),
  run: anim("run", 8, 14),
  climb: anim("climb", 4, 8),
  bar: anim("bar", 4, 8),
  fall: anim("fall", 2, 8),
  dig: anim("dig", 4, 12),
  drill: anim("drill", 2, 20),
  die: anim("die", 1, 1),
};

export const MONK_ANIMS: Readonly<Record<MonkAction, Animation>> = {
  idle: anim("idle", 1, 1),
  run: anim("run", 8, 12),
  climb: anim("climb", 4, 7),
  bar: anim("bar", 4, 7),
  fall: anim("fall", 2, 8),
  trapped: anim("trapped", 2, 4),
  escaping: anim("escaping", 4, 8),
  snared: anim("snared", 2, 2),
  dazed: anim("dazed", 2, 3),
};

/** Moving actors run through their cycle; one standing still holds its first frame. */
export interface Pose {
  readonly kind: ActorKind;
  readonly anim: Animation;
  readonly moving: boolean;
  readonly facing: -1 | 1;
}

/** How an actor in free movement looks: falling, on a bar, on a ladder, or on its feet. */
function freePose(t: Terrain, a: Actor): "fall" | "bar" | "climb" | "ground" {
  if (isFalling(t, a)) return "fall";
  const cx = cellOf(a.x + SUB / 2);
  const cy = cellOf(a.y + SUB / 2);
  if (isBar(t, cx, cy) && a.y % SUB === 0) return "bar";
  if (isLadder(t, cx, cy) || (a.y % SUB !== 0 && isLadder(t, cx, cy + 1))) return "climb";
  return "ground";
}

/** Where an actor was last seen, and the tick its position last changed. */
interface Seen {
  readonly x: number;
  readonly y: number;
  readonly tick: number;
}

/** When each actor last moved, kept by the renderer from frame to frame. */
export interface Motion {
  readonly players: readonly Seen[];
  readonly monks: readonly Seen[];
}

/**
 * An actor still counts as moving this many ticks after its last step: the slowest
 * gait (goo) steps every `GOO_PERIOD` ticks, so a walking actor never looks still
 * between two steps.
 */
export const STILL_AFTER = GOO_PERIOD;

function see(before: Seen | undefined, a: Actor, tick: number): Seen {
  // A first sighting, or a restarted level (time went back), counts as still.
  if (before === undefined || tick < before.tick) return { x: a.x, y: a.y, tick: -Infinity };
  if (before.x === a.x && before.y === a.y) return before;
  return { x: a.x, y: a.y, tick };
}

/** The motion record after seeing `state` (`prev`: the record of earlier frames). */
export function trackMotion(prev: Motion | null, state: GameState): Motion {
  return {
    players: state.players.map((p, i) => see(prev?.players[i], p, state.tick)),
    monks: state.monks.map((m, i) => see(prev?.monks[i], m, state.tick)),
  };
}

function moving(seen: Seen | undefined, tick: number): boolean {
  return seen !== undefined && tick - seen.tick <= STILL_AFTER;
}

/** The pose of player `index`, given the motion record (`trackMotion`) of this state. */
export function playerPose(state: GameState, motion: Motion | null, index: number): Pose {
  const p: Player | undefined = state.players[index];
  const kind = index === 1 ? "runner2" : "runner1";
  if (p === undefined) return { kind, anim: RUNNER_ANIMS.idle, moving: false, facing: 1 };
  const pose = (action: RunnerAction, moving = true): Pose => ({
    kind,
    anim: RUNNER_ANIMS[action],
    moving,
    facing: p.facing,
  });
  if (p.mode !== "alive") return pose("die", false);
  if (p.drill) return pose("drill");
  if (p.busy > 0) return pose("dig");
  const free = freePose(state, p);
  const walking = moving(motion?.players[index], state.tick);
  if (free === "fall") return pose("fall");
  if (free === "ground") return walking ? pose("run") : pose("idle", false);
  return pose(free, walking);
}

/** The pose of monk `index`. */
export function monkPose(state: GameState, motion: Motion | null, index: number): Pose {
  const m: Monk | undefined = state.monks[index];
  if (m === undefined) return { kind: "monk", anim: MONK_ANIMS.idle, moving: false, facing: 1 };
  const pose = (action: MonkAction, moving = true): Pose => ({
    kind: "monk",
    anim: MONK_ANIMS[action],
    moving,
    facing: m.facing,
  });
  switch (m.mode) {
    case "trapped":
      return pose("trapped");
    case "escaping":
      return pose("escaping");
    case "snared":
      return pose("snared");
    case "dazed":
      return pose("dazed");
    case "dead":
    case "free":
      break;
  }
  // Other monks hold a monk up; physics reads them from the state without this one.
  const others = { ...state, monks: state.monks.filter((_, i) => i !== index) };
  const free = freePose(others, m);
  const walking = moving(motion?.monks[index], state.tick);
  if (free === "fall") return pose("fall");
  if (free === "ground") return walking ? pose("run") : pose("idle", false);
  return pose(free, walking);
}

/** The sprite of a pose at render time `timeMs`. */
export function poseSprite(pose: Pose, timeMs: number): string {
  const frame = pose.moving ? frameAt(pose.anim, timeMs) : 0;
  return `${pose.kind}/${frameKey(pose.anim, frame)}`;
}
