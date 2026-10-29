import type { PlayerInput } from "../sim/input";
import type { PlayerCount } from "../sim/state";

export type Action = keyof PlayerInput;

/** Key bindings use `KeyboardEvent.code` (physical keys), so layouts like AZERTY work. */
export type Bindings = Readonly<Record<Action, readonly string[]>>;

/** One player alone: arrows, and the two keys right of left Shift to dig. */
export const DEFAULT_BINDINGS: Bindings = {
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  // Physical positions: the two keys right of left Shift. Labelled Z/X on QWERTY, W/X on AZERTY.
  digLeft: ["KeyZ"],
  digRight: ["KeyX"],
  // The next keys along: C, then V, on QWERTY and AZERTY.
  pickUp: ["KeyC"],
  use: ["KeyV"],
};

/**
 * Two players on one keyboard, each on their own side. Player 1 (right) keeps the
 * arrows and digs with the two keys left of right Shift: . and / on QWERTY, : and ! on
 * AZERTY; it picks up with the key before them (, on QWERTY, ; on AZERTY) and uses a
 * tool with the one before that (M on QWERTY, , on AZERTY). Player 2 (left) moves with
 * W A S D (Z Q S D on AZERTY), digs with the keys above A and D: Q and E (A and E on
 * AZERTY), picks up with R and uses a tool with F.
 */
export const TWO_PLAYER_BINDINGS: readonly [Bindings, Bindings] = [
  {
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    digLeft: ["Period"],
    digRight: ["Slash"],
    pickUp: ["Comma"],
    use: ["KeyM"],
  },
  {
    left: ["KeyA"],
    right: ["KeyD"],
    up: ["KeyW"],
    down: ["KeyS"],
    digLeft: ["KeyQ"],
    digRight: ["KeyE"],
    pickUp: ["KeyR"],
    use: ["KeyF"],
  },
];

/** Every player's bindings for a game of `count` players, player 1 first. */
export function bindingsFor(count: PlayerCount): readonly Bindings[] {
  return count === 1 ? [DEFAULT_BINDINGS] : TWO_PLAYER_BINDINGS;
}

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
    pickUp: pressed("pickUp"),
    use: pressed("use"),
  };
}

/** Every player's input for one tick, from the held keys. */
export function inputsFrom(held: HeldKeys, count: PlayerCount): PlayerInput[] {
  return bindingsFor(count).map((b) => inputFrom(held, b));
}

/**
 * Whether a key is bound to any action of a `count`-player game (used to stop arrow
 * keys scrolling the page, and / opening Firefox's quick find).
 */
export function isBound(code: string, count: PlayerCount = 1): boolean {
  return bindingsFor(count).some((b) => Object.values(b).some((codes) => codes.includes(code)));
}
