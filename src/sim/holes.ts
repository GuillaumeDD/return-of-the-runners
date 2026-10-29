import { HOLE_TICKS } from "./rules";

/** A hole dug in a brick cell. `age` counts ticks since digging started. */
export interface Hole {
  readonly cx: number;
  readonly cy: number;
  readonly age: number;
}

export type HolePhase = "digging" | "open" | "closing" | "filled";

export function holePhase(age: number): HolePhase {
  if (age < HOLE_TICKS.digging) return "digging";
  if (age < HOLE_TICKS.digging + HOLE_TICKS.open) return "open";
  if (age < HOLE_TICKS.digging + HOLE_TICKS.open + HOLE_TICKS.closing) return "closing";
  return "filled";
}

/** Total lifetime of a hole, in ticks. */
export const HOLE_LIFETIME = HOLE_TICKS.digging + HOLE_TICKS.open + HOLE_TICKS.closing;

export function holeAt(holes: readonly Hole[], cx: number, cy: number): Hole | undefined {
  return holes.find((h) => h.cx === cx && h.cy === cy);
}

/** Whether the brick at (cx, cy) is currently dug out (passable). */
export function isDugOut(holes: readonly Hole[], cx: number, cy: number): boolean {
  const h = holeAt(holes, cx, cy);
  if (h === undefined) return false;
  const phase = holePhase(h.age);
  return phase === "open" || phase === "closing";
}

/**
 * A brick blown away by a small bomb (`bombs.ts`): empty for `left` more ticks, then the
 * brick comes back. Kept in `GameState.craters` in creation order.
 */
export interface Crater {
  readonly cx: number;
  readonly cy: number;
  readonly left: number;
}

export function craterAt(craters: readonly Crater[], cx: number, cy: number): Crater | undefined {
  return craters.find((c) => c.cx === cx && c.cy === cy);
}

/** Whether the cell (cx, cy) is opened for now: a dug-out hole or a crater. */
export function isOpened(
  t: { readonly holes: readonly Hole[]; readonly craters: readonly Crater[] },
  cx: number,
  cy: number,
): boolean {
  return isDugOut(t.holes, cx, cy) || craterAt(t.craters, cx, cy) !== undefined;
}
