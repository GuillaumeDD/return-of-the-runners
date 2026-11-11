import type { MessageKey } from "../i18n";
import firstSteps from "./first-steps.json?raw";

/**
 * One level of the bundled pack: a stable `id` (progress is remembered by it, so it
 * never changes once shipped), its title in every language (the level file's own
 * `name` is the English one) and the level document itself.
 */
export interface PackEntry {
  readonly id: string;
  readonly title: MessageKey;
  readonly text: string;
}

/** The levels of the play screen, in the order they are played (B-051). */
export const PACK: readonly PackEntry[] = [
  { id: "first-steps", title: "levelFirstSteps", text: firstSteps },
];

/** The level after `index`; after the last one, the pack starts over. */
export function nextIndex(index: number, count: number): number {
  return (index + 1) % count;
}
