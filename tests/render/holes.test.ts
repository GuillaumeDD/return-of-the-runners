import { describe, expect, it } from "vitest";
import { brickLeft } from "../../src/render/canvas";
import { HOLE_LIFETIME } from "../../src/sim/holes";
import { HOLE_TICKS } from "../../src/sim/rules";

describe("brickLeft", () => {
  it("starts as a whole brick and is fully open once dug", () => {
    expect(brickLeft(0)).toBe(1);
    expect(brickLeft(HOLE_TICKS.digging)).toBe(0);
    expect(brickLeft(HOLE_TICKS.digging + HOLE_TICKS.open - 1)).toBe(0);
  });

  it("grows back while closing and never leaves [0, 1]", () => {
    let prev = 0;
    for (let age = HOLE_TICKS.digging + HOLE_TICKS.open; age < HOLE_LIFETIME; age++) {
      const v = brickLeft(age);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThan(1);
      prev = v;
    }
    for (let age = 0; age <= HOLE_LIFETIME; age++) {
      expect(brickLeft(age)).toBeGreaterThanOrEqual(0);
      expect(brickLeft(age)).toBeLessThanOrEqual(1);
    }
  });
});

describe("brickLeft of a drilled hole", () => {
  it("stays a whole cell while its negative age counts up, then opens as a dug one", () => {
    for (let age = -100; age <= 0; age++) expect(brickLeft(age)).toBe(1);
    expect(brickLeft(HOLE_TICKS.digging)).toBe(0);
  });
});
