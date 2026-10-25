import { describe, expect, it } from "vitest";
import { blankGrid, NEW_LEVEL_SIZE } from "../../src/editor/blank";

describe("blankGrid", () => {
  it("is 28×16 by default: empty rows on a bedrock floor", () => {
    const g = blankGrid();
    expect(g).toHaveLength(NEW_LEVEL_SIZE.height);
    expect(g.every((row) => row.length === NEW_LEVEL_SIZE.width)).toBe(true);
    expect(g.slice(0, -1).every((row) => /^\.+$/.test(row))).toBe(true);
    expect(g.at(-1)).toBe("@".repeat(NEW_LEVEL_SIZE.width));
  });

  it("takes any size within the format limits, and clamps the rest", () => {
    expect(blankGrid(8, 8)).toEqual([...Array<string>(7).fill("........"), "@@@@@@@@"]);
    const size = (g: string[]): [number, number] => [g[0]?.length ?? 0, g.length];
    expect(size(blankGrid(64, 48))).toEqual([64, 48]);
    expect(size(blankGrid(100, 100))).toEqual([64, 48]);
    expect(size(blankGrid(-1, 0))).toEqual([8, 8]);
    expect(size(blankGrid(10.5, Number.NaN))).toEqual([8, 8]);
  });
});
