import { describe, expect, it } from "vitest";
import {
  DEFAULT_BINDINGS,
  inputFrom,
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
    };
    expect(inputFrom(keyDown(new Set(), "KeyA"), wasd)).toEqual({ ...NO_INPUT, left: true });
    expect(inputFrom(keyDown(new Set(), "ArrowLeft"), wasd)).toEqual(NO_INPUT);
  });

  it("binds every action by default", () => {
    for (const codes of Object.values(DEFAULT_BINDINGS)) expect(codes.length).toBeGreaterThan(0);
  });
});
