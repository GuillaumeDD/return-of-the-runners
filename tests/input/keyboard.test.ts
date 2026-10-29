import { describe, expect, it } from "vitest";
import {
  DEFAULT_BINDINGS,
  TWO_PLAYER_BINDINGS,
  bindingsFor,
  inputFrom,
  inputsFrom,
  isBound,
  keyDown,
  keyUp,
  type Bindings,
} from "../../src/input/keyboard";
import { NO_INPUT } from "../../src/sim/input";

describe("keyboard input", () => {
  it("held keys map to actions", () => {
    const held = keyDown(keyDown(new Set(), "ArrowLeft"), "ArrowUp");
    expect(inputFrom(held)).toEqual({ ...NO_INPUT, left: true, up: true });
  });

  it("releasing a key clears its action", () => {
    const held = keyUp(keyDown(new Set(), "ArrowRight"), "ArrowRight");
    expect(inputFrom(held)).toEqual(NO_INPUT);
  });

  it("passes opposite directions through (the simulation cancels them)", () => {
    const held = keyDown(keyDown(new Set(), "ArrowLeft"), "ArrowRight");
    expect(inputFrom(held)).toMatchObject({ left: true, right: true });
  });

  it("keyDown and keyUp do not mutate the previous set", () => {
    const a = new Set<string>();
    const b = keyDown(a, "ArrowUp");
    keyUp(b, "ArrowUp");
    expect(a.size).toBe(0);
    expect(b.has("ArrowUp")).toBe(true);
  });

  it("maps the dig keys", () => {
    expect(inputFrom(keyDown(new Set(), "KeyZ"))).toEqual({ ...NO_INPUT, digLeft: true });
    expect(inputFrom(keyDown(new Set(), "KeyX"))).toEqual({ ...NO_INPUT, digRight: true });
  });

  it("maps the pick-up key: C alone; comma for player 1 and R for player 2 together", () => {
    expect(inputFrom(keyDown(new Set(), "KeyC"))).toEqual({ ...NO_INPUT, pickUp: true });
    expect(inputsFrom(keyDown(new Set(), "Comma"), 2)).toEqual([
      { ...NO_INPUT, pickUp: true },
      NO_INPUT,
    ]);
    expect(inputsFrom(keyDown(new Set(), "KeyR"), 2)).toEqual([
      NO_INPUT,
      { ...NO_INPUT, pickUp: true },
    ]);
  });

  it("maps the use key: V alone; M for player 1 and F for player 2 together", () => {
    expect(inputFrom(keyDown(new Set(), "KeyV"))).toEqual({ ...NO_INPUT, use: true });
    expect(inputsFrom(keyDown(new Set(), "KeyM"), 2)).toEqual([
      { ...NO_INPUT, use: true },
      NO_INPUT,
    ]);
    expect(inputsFrom(keyDown(new Set(), "KeyF"), 2)).toEqual([
      NO_INPUT,
      { ...NO_INPUT, use: true },
    ]);
  });

  it("maps the bomb key: B alone; N for player 1 and G for player 2 together", () => {
    expect(inputFrom(keyDown(new Set(), "KeyB"))).toEqual({ ...NO_INPUT, bomb: true });
    expect(inputsFrom(keyDown(new Set(), "KeyN"), 2)).toEqual([
      { ...NO_INPUT, bomb: true },
      NO_INPUT,
    ]);
    expect(inputsFrom(keyDown(new Set(), "KeyG"), 2)).toEqual([
      NO_INPUT,
      { ...NO_INPUT, bomb: true },
    ]);
  });

  it("ignores unbound keys", () => {
    expect(inputFrom(keyDown(new Set(), "KeyQ"))).toEqual(NO_INPUT);
    expect(isBound("KeyQ")).toBe(false);
    expect(isBound("ArrowDown")).toBe(true);
  });

  it("uses the bindings table, so keys can be remapped", () => {
    const wasd: Bindings = {
      left: ["KeyA"],
      right: ["KeyD"],
      up: ["KeyW"],
      down: ["KeyS"],
      digLeft: ["KeyQ"],
      digRight: ["KeyE"],
      pickUp: ["KeyF"],
      use: ["KeyG"],
      bomb: ["KeyH"],
    };
    expect(inputFrom(keyDown(new Set(), "KeyA"), wasd)).toEqual({ ...NO_INPUT, left: true });
    expect(inputFrom(keyDown(new Set(), "ArrowLeft"), wasd)).toEqual(NO_INPUT);
  });

  it("binds every action by default", () => {
    for (const codes of Object.values(DEFAULT_BINDINGS)) expect(codes.length).toBeGreaterThan(0);
  });
});

const codesOf = (b: Bindings): string[] => Object.values(b).flat();

describe("two players on one keyboard", () => {
  it("player 1 and player 2 share no key, and each binds every action", () => {
    const [one, two] = TWO_PLAYER_BINDINGS;
    const shared = codesOf(one).filter((c) => codesOf(two).includes(c));
    expect(shared).toEqual([]);
    for (const b of TWO_PLAYER_BINDINGS) {
      for (const codes of Object.values(b)) expect(codes.length).toBeGreaterThan(0);
    }
  });

  it("each player's keys produce only that player's input", () => {
    TWO_PLAYER_BINDINGS.forEach((b, player) => {
      for (const [action, codes] of Object.entries(b)) {
        for (const code of codes) {
          const inputs = inputsFrom(keyDown(new Set(), code), 2);
          expect(inputs[player], code).toEqual({ ...NO_INPUT, [action]: true });
          expect(inputs[1 - player], code).toEqual(NO_INPUT);
        }
      }
    });
  });

  it("both players can press keys at once", () => {
    let held = keyDown(new Set(), "ArrowLeft");
    held = keyDown(held, "KeyD");
    held = keyDown(held, "KeyE");
    expect(inputsFrom(held, 2)).toEqual([
      { ...NO_INPUT, left: true },
      { ...NO_INPUT, right: true, digRight: true },
    ]);
  });

  it("one player keeps the one-player keys; the two-player keys of the other are not bound", () => {
    expect(bindingsFor(1)).toEqual([DEFAULT_BINDINGS]);
    expect(inputsFrom(keyDown(new Set(), "KeyZ"), 1)).toEqual([{ ...NO_INPUT, digLeft: true }]);
    expect(isBound("KeyW", 1)).toBe(false);
    expect(isBound("KeyW", 2)).toBe(true);
    expect(isBound("Slash", 2)).toBe(true);
    // With two players, Z and X sit under player 2's hand: not bound.
    expect(isBound("KeyZ", 2)).toBe(false);
  });
});
