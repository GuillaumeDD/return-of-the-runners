/**
 * Runners and monks, drawn as vectors (style guide: ARCHITECTURE § Art direction). Each
 * pose is a skeleton (head, neck, hip, two arms, two legs) computed from the action and
 * the frame, then dressed: a suit and helmet or scarf for the runners, a hooded robe for
 * the monks. Drawn facing right in a 32-unit cell with 16 units of headroom above it;
 * the renderer mirrors it for actors facing left.
 */
import type { ActorKind, MonkAction, RunnerAction } from "../actors";

type P = readonly [number, number];
interface Skeleton {
  readonly head: P;
  readonly neck: P;
  readonly hip: P;
  /** Back limb first: it is drawn behind the body. */
  readonly arms: readonly [readonly P[], readonly P[]];
  readonly legs: readonly [readonly P[], readonly P[]];
  /** Seen from behind (climbing): no face. */
  readonly back?: boolean;
}

/** Units above the cell, for raised hands and carried gold. */
export const HEADROOM = 16;
/** The sprite box, in art units. */
export const BOX = { width: 32, height: 32 + HEADROOM } as const;

const TAU = Math.PI * 2;

function limb(from: P, a1: number, l1: number, a2: number, l2: number): P[] {
  // Angles from straight down, positive towards +x (forward).
  const knee: P = [from[0] + Math.sin(a1) * l1, from[1] + Math.cos(a1) * l1];
  const foot: P = [knee[0] + Math.sin(a2) * l2, knee[1] + Math.cos(a2) * l2];
  return [from, knee, foot];
}

/** Running: legs and arms swing in opposition, the body bobs and leans forward. */
function running(frame: number, frames: number): Skeleton {
  const a = (frame / frames) * TAU;
  const bob = Math.abs(Math.sin(a)) * -1.2;
  const hip: P = [15.5, 21 + bob];
  const neck: P = [17.2, 14 + bob];
  const leg = (s: number): P[] => {
    const th = 0.6 * Math.sin(a + s);
    const bend = 0.25 + 0.75 * Math.max(0, -Math.cos(a + s));
    return limb(hip, th, 5.5, th - bend, 5.5);
  };
  const arm = (s: number): P[] => {
    const th = -0.7 * Math.sin(a + s);
    return limb([neck[0], neck[1] + 1], th, 4.5, th + 1.1, 4);
  };
  return {
    head: [18.2, 9.5 + bob],
    neck,
    hip,
    arms: [arm(0), arm(Math.PI)],
    legs: [leg(Math.PI), leg(0)],
  };
}

/** Climbing a ladder, seen from behind: hands and feet alternate. */
function climbing(frame: number, frames: number): Skeleton {
  const s = Math.sin((frame / frames) * TAU);
  return {
    head: [16, 10],
    neck: [16, 14],
    hip: [16, 22],
    arms: [
      [
        [14.5, 15],
        [11, 12 + 2 * s],
        [10.5, 8 + 4 * s],
      ],
      [
        [17.5, 15],
        [21, 12 - 2 * s],
        [21.5, 8 - 4 * s],
      ],
    ],
    legs: [
      [
        [15, 22],
        [12, 26 - 2 * s],
        [12.5, 30 - 2 * s],
      ],
      [
        [17, 22],
        [20, 26 + 2 * s],
        [19.5, 30 + 2 * s],
      ],
    ],
    back: true,
  };
}

/** Hand over hand on a bar: hands at the bar's height, legs swinging. */
function hanging(frame: number, frames: number): Skeleton {
  const s = Math.sin((frame / frames) * TAU);
  const c = Math.cos((frame / frames) * TAU);
  return {
    head: [16, 11],
    neck: [16, 14],
    hip: [16 - s, 22],
    arms: [
      [
        [15, 14.5],
        [13 + s, 10],
        [12.5 + 2 * s, 6],
      ],
      [
        [17, 14.5],
        [19 - s, 10],
        [19.5 - 2 * s, 6],
      ],
    ],
    legs: [
      [
        [16 - s, 22],
        [14.5 - 2 * s, 26],
        [14 - 3 * s, 30],
      ],
      [
        [16 - s, 22],
        [17.5 - 2 * c, 26],
        [18 - 3 * c, 29.5],
      ],
    ],
  };
}

/** Falling: arms up, legs apart, flailing. */
function falling(frame: number): Skeleton {
  const f = frame % 2 === 0 ? 1 : -1;
  return {
    head: [16, 11],
    neck: [16, 15],
    hip: [16, 22],
    arms: [
      [
        [15, 15.5],
        [11, 12 + f],
        [9, 8 - f],
      ],
      [
        [17, 15.5],
        [21, 12 - f],
        [23, 8 + f],
      ],
    ],
    legs: [
      [
        [15.5, 22],
        [12.5, 26],
        [12 + f, 30],
      ],
      [
        [16.5, 22],
        [19.5, 26],
        [20 - f, 30],
      ],
    ],
  };
}

/** Digging: a crouch towards the brick ahead, one arm striking down. */
function digging(frame: number, frames: number): Skeleton {
  const t = Math.sin((frame / frames) * Math.PI);
  return {
    head: [19, 14 + t],
    neck: [17.5, 17 + t],
    hip: [14.5, 23],
    arms: [
      [
        [17.5, 18],
        [20, 21],
        [22, 24],
      ],
      [
        [17.5, 18],
        [21 + 2 * t, 17 + 5 * t],
        [23 + 4 * t, 15 + 13 * t],
      ],
    ],
    legs: [
      [
        [14.5, 23],
        [11, 26],
        [11, 30.5],
      ],
      [
        [14.5, 23],
        [19, 25],
        [19, 30.5],
      ],
    ],
  };
}

/** Drilling: braced over the jackhammer, shaking. */
function drilling(frame: number): Skeleton {
  const j = frame % 2 === 0 ? 0.6 : -0.6;
  return {
    head: [17, 11 + j],
    neck: [16.5, 15 + j],
    hip: [15.5, 22],
    arms: [
      [
        [16.5, 16 + j],
        [19, 19 + j],
        [20, 21],
      ],
      [
        [16.5, 16 + j],
        [20, 18 + j],
        [22, 21],
      ],
    ],
    legs: [
      [
        [15.5, 22],
        [12.5, 26],
        [12, 30.5],
      ],
      [
        [15.5, 22],
        [18.5, 26],
        [19, 30.5],
      ],
    ],
  };
}

/** Standing still. */
function standing(): Skeleton {
  return {
    head: [16.5, 10],
    neck: [16, 14],
    hip: [16, 22],
    arms: [
      [
        [15.5, 15],
        [14.5, 19],
        [14.5, 22.5],
      ],
      [
        [16.5, 15],
        [17.5, 19],
        [18, 22.5],
      ],
    ],
    legs: [
      [
        [15.5, 22],
        [14.5, 26],
        [14, 30.5],
      ],
      [
        [16.5, 22],
        [17.5, 26],
        [18, 30.5],
      ],
    ],
  };
}

/** Lying where it fell. */
function lying(): Skeleton {
  return {
    head: [25, 27.5],
    neck: [21, 27.5],
    hip: [13, 28.5],
    arms: [
      [
        [21, 28],
        [18, 30],
        [15, 30.5],
      ],
      [
        [21, 27.5],
        [24, 30],
        [27, 30.5],
      ],
    ],
    legs: [
      [
        [13, 28.5],
        [9, 29],
        [5, 30.5],
      ],
      [
        [13, 28.5],
        [9, 27],
        [5, 28.5],
      ],
    ],
  };
}

/** Trapped in a hole: arms up, reaching for the rim. */
function reaching(frame: number): Skeleton {
  const f = frame % 2 === 0 ? 1 : -1;
  return {
    head: [16, 11],
    neck: [16, 15],
    hip: [16, 23],
    arms: [
      [
        [15, 15.5],
        [11, 12 + f],
        [9.5, 7 + 2 * f],
      ],
      [
        [17, 15.5],
        [21, 12 - f],
        [22.5, 7 - 2 * f],
      ],
    ],
    legs: [
      [
        [15, 23],
        [13.5, 27],
        [13.5, 31],
      ],
      [
        [17, 23],
        [18.5, 27],
        [18.5, 31],
      ],
    ],
  };
}

function skeleton(action: RunnerAction | MonkAction, frame: number, frames: number): Skeleton {
  switch (action) {
    case "run":
      return running(frame, frames);
    case "climb":
    case "escaping":
      return climbing(frame, frames);
    case "bar":
      return hanging(frame, frames);
    case "fall":
      return falling(frame);
    case "dig":
      return digging(frame, frames);
    case "drill":
      return drilling(frame);
    case "die":
      return lying();
    case "trapped":
      return reaching(frame);
    case "idle":
    case "dazed":
    case "snared":
      return standing();
  }
}

function stroke(ctx: CanvasRenderingContext2D, pts: readonly P[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

const OUTLINE = "rgba(20,10,5,0.85)";

/** A limb with its dark outline (1.5 units around, per the style guide). */
function limbLine(
  ctx: CanvasRenderingContext2D,
  pts: readonly P[],
  color: string,
  w: number,
): void {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = w + 3;
  stroke(ctx, pts);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  stroke(ctx, pts);
}

/** Runner colours (provisional with the hero names: PRD § Open questions). */
export const RUNNER_LOOK = {
  runner1: { suit: "#f1f4f6", shade: "#9aa6b2", accent: "#19b8d0", skin: "#f2c9a0" },
  runner2: { suit: "#c6b8ff", shade: "#7a64d6", accent: "#ffffff", skin: "#e8b48a" },
} as const;

export const MONK_LOOK = { robe: "#d42a2a", shade: "#7a1010", eye: "#ffe36b" } as const;

function drawRunner(ctx: CanvasRenderingContext2D, kind: "runner1" | "runner2", k: Skeleton): void {
  const look = RUNNER_LOOK[kind];
  limbLine(ctx, k.legs[0], look.shade, 3);
  limbLine(ctx, k.arms[0], look.shade, 2.6);
  limbLine(ctx, [k.neck, k.hip], look.suit, 4.5);
  limbLine(ctx, k.legs[1], look.suit, 3);
  limbLine(ctx, k.arms[1], look.suit, 2.6);
  // Belt.
  const [hx, hy] = k.hip;
  const [nx, ny] = k.neck;
  const bx = hx + (nx - hx) * 0.2;
  const by = hy + (ny - hy) * 0.2;
  ctx.fillStyle = look.accent;
  ctx.beginPath();
  ctx.arc(bx, by, 1.6, 0, TAU);
  ctx.fill();
  const [x, y] = k.head;
  ctx.beginPath();
  ctx.arc(x, y, 4.2, 0, TAU);
  ctx.fillStyle = k.back === true ? look.suit : look.skin;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (kind === "runner1") {
    // A helmet with a lamp: runner 1's silhouette.
    ctx.beginPath();
    ctx.arc(x, y - 0.5, 4.6, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = look.accent;
    ctx.fill();
    ctx.stroke();
    if (k.back !== true) {
      ctx.fillStyle = "#fffbe0";
      ctx.fillRect(x + 3, y - 3.5, 2.5, 2);
    }
  } else {
    // A scarf streaming behind: runner 2's silhouette.
    ctx.beginPath();
    ctx.moveTo(x - 1, y + 3.5);
    ctx.quadraticCurveTo(x - 7, y + 2, x - 11, y + 5);
    ctx.quadraticCurveTo(x - 7, y + 5, x - 1, y + 5.5);
    ctx.fillStyle = "#ff6fae";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - 1, 4.4, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#5b3fb8";
    ctx.stroke();
  }
}

function drawMonk(ctx: CanvasRenderingContext2D, k: Skeleton, dazed: boolean): void {
  const m = MONK_LOOK;
  for (const l of k.legs) limbLine(ctx, l.slice(1), m.shade, 3);
  limbLine(ctx, k.arms[0], m.shade, 3);
  // The robe: a bell from the shoulders to the knees.
  const [nx, ny] = k.neck;
  const [hx, hy] = k.hip;
  const g = ctx.createLinearGradient(hx - 6, 0, hx + 6, 0);
  g.addColorStop(0, m.robe);
  g.addColorStop(0.6, m.robe);
  g.addColorStop(1, m.shade);
  ctx.beginPath();
  ctx.moveTo(nx - 3, ny);
  ctx.lineTo(nx + 3, ny);
  ctx.lineTo(hx + 6, hy + 4);
  ctx.quadraticCurveTo(hx, hy + 6, hx - 6, hy + 4);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  limbLine(ctx, k.arms[1], m.robe, 3.2);
  // The hood, pointed at the back, and two glowing eyes (none from behind).
  const [x, y] = k.head;
  ctx.beginPath();
  ctx.arc(x, y, 4.8, 0, TAU);
  ctx.moveTo(x - 3, y - 3);
  ctx.lineTo(x - 7, y - 6);
  ctx.lineTo(x - 4.5, y + 1);
  ctx.fillStyle = m.robe;
  ctx.fill();
  ctx.stroke();
  if (k.back === true) return;
  ctx.beginPath();
  ctx.arc(x + 1, y + 0.5, 3, 0, TAU);
  ctx.fillStyle = "#1a0606";
  ctx.fill();
  ctx.fillStyle = dazed ? "#b0a070" : m.eye;
  if (dazed) {
    // Eyes half shut.
    ctx.fillRect(x + 0.2, y + 0.3, 1.4, 0.7);
    ctx.fillRect(x + 2.4, y + 0.3, 1.4, 0.7);
  } else {
    ctx.fillRect(x + 0.2, y - 0.3, 1.4, 1.4);
    ctx.fillRect(x + 2.4, y - 0.3, 1.4, 1.4);
  }
}

/**
 * Draws one frame of an actor's animation in the sprite box (`BOX`, art units), facing
 * right. A snared monk hangs upside down from the top of its cell.
 */
export function drawActorFrame(
  ctx: CanvasRenderingContext2D,
  kind: ActorKind,
  action: RunnerAction | MonkAction,
  frame: number,
  frames: number,
): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.translate(0, HEADROOM);
  const k = skeleton(action, frame, frames);
  if (kind === "monk") {
    if (action === "snared") {
      // Upside down, swaying a little, under a rope from the cell's top.
      const sway = frame % 2 === 0 ? 0.08 : -0.08;
      ctx.strokeStyle = "#a8864e";
      ctx.lineWidth = 1.5;
      stroke(ctx, [
        [16, 0],
        [16, 3],
      ]);
      ctx.translate(16, 16);
      ctx.rotate(Math.PI + sway);
      ctx.translate(-16, -16);
    }
    drawMonk(ctx, k, action === "dazed");
  } else {
    drawRunner(ctx, kind, k);
  }
  ctx.restore();
}
