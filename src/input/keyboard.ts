import type { PlayerInput } from "../sim/input";

export type Action = keyof PlayerInput;

/** Key bindings use `KeyboardEvent.code` (physical keys), so layouts like AZERTY work. */
export type Bindings = Readonly<Record<Action, readonly string[]>>;

export const DEFAULT_BINDINGS: Bindings = {
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  // Physical positions: the two keys right of left Shift. Labelled Z/X on QWERTY, W/X on AZERTY.
  digLeft: ["KeyZ"],
  digRight: ["KeyX"],
};

/** The set of currently held key codes. Plain data; updated by `keyDown` / `keyUp`. */
export type HeldKeys = ReadonlySet<string>;

export function keyDown(held: HeldKeys, code: string): HeldKeys {
  if (held.has(code)) return held;
  return new Set([...held, code]);
}

export function keyUp(held: HeldKeys, code: string): HeldKeys {
  if (!held.has(code)) return held;
  const next = new Set(held);
  next.delete(code);
  return next;
}

/**
 * Maps held keys to one tick of input. Opposite directions are passed through as-is:
 * the simulation decides that they cancel out.
 */
export function inputFrom(held: HeldKeys, bindings: Bindings = DEFAULT_BINDINGS): PlayerInput {
  const pressed = (action: Action): boolean => bindings[action].some((code) => held.has(code));
  return {
    left: pressed("left"),
    right: pressed("right"),
    up: pressed("up"),
    down: pressed("down"),
    digLeft: pressed("digLeft"),
    digRight: pressed("digRight"),
  };
}

/** Whether a key is bound to any action (used to stop arrow keys scrolling the page). */
export function isBound(code: string, bindings: Bindings = DEFAULT_BINDINGS): boolean {
  return Object.values(bindings).some((codes) => codes.includes(code));
}
