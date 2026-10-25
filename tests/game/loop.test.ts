import { describe, expect, it } from "vitest";
import { advance, MAX_FRAME_MS, TICK_MS, type Accumulator } from "../../src/game/loop";
import { TICKS_PER_SECOND } from "../../src/sim/rules";

function runFrames(frameMs: number, frames: number): number {
  let acc: Accumulator = { carry: 0 };
  let ticks = 0;
  for (let i = 0; i < frames; i++) {
    const r = advance(acc, frameMs);
    ticks += r.ticks;
    acc = r.acc;
  }
  return ticks;
}

describe("fixed-timestep accumulator", () => {
  it("one second of 60 Hz frames gives exactly 60 ticks", () => {
    expect(runFrames(1000 / 60, 60)).toBe(TICKS_PER_SECOND);
  });

  it("one second of 144 Hz frames also gives exactly 60 ticks", () => {
    expect(runFrames(1000 / 144, 144)).toBe(TICKS_PER_SECOND);
  });

  it("ten minutes of 60 Hz frames does not drift", () => {
    expect(runFrames(1000 / 60, 60 * 600)).toBe(TICKS_PER_SECOND * 600);
  });

  it("carries leftover time to the next frame", () => {
    const first = advance({ carry: 0 }, TICK_MS * 1.5);
    expect(first.ticks).toBe(1);
    const second = advance(first.acc, TICK_MS * 0.5);
    expect(second.ticks).toBe(1);
  });

  it("caps long frames (no spiral of death)", () => {
    const r = advance({ carry: 0 }, 10_000);
    // 250 ms at 60 ticks/s is exactly 15 ticks (exact integer maths, not 250 / 16.67).
    expect(r.ticks).toBe((MAX_FRAME_MS * TICKS_PER_SECOND) / 1000);
  });

  it("treats negative elapsed time as zero", () => {
    expect(advance({ carry: 0 }, -50).ticks).toBe(0);
  });
});
