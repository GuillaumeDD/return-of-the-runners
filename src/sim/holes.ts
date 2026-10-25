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
