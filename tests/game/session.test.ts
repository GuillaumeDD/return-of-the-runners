import { describe, expect, it } from "vitest";
import {
  RESTART_DELAY_TICKS,
  createSession,
  tickSession,
  type Session,
} from "../../src/game/session";
import { NO_INPUT } from "../../src/sim/input";
import { press, stateFrom } from "../sim/helpers";

const rows = ["........", "...P....", "########"];

describe("session", () => {
  it("steps the simulation while playing", () => {
    const s = tickSession(createSession(stateFrom(rows)), [press.right]);
    expect(s.state.tick).toBe(1);
    expect(s.endTicks).toBe(0);
  });

  it("restarts the level RESTART_DELAY_TICKS ticks after a win", () => {
    const start = stateFrom(rows);
    let s: Session = { ...createSession(start), state: { ...start, status: "won" } };
    for (let i = 0; i < RESTART_DELAY_TICKS - 1; i++) s = tickSession(s, [NO_INPUT]);
    expect(s.state.status).toBe("won");
    s = tickSession(s, [NO_INPUT]);
    expect(s.state).toBe(start);
  });

  it("restarts the level RESTART_DELAY_TICKS ticks after death", () => {
    const start = stateFrom(rows);
    let s: Session = { ...createSession(start), state: { ...start, tick: 50, status: "dead" } };
    for (let i = 0; i < RESTART_DELAY_TICKS - 1; i++) s = tickSession(s, [NO_INPUT]);
    expect(s.state.status).toBe("dead");
    expect(s.endTicks).toBe(RESTART_DELAY_TICKS - 1);
    s = tickSession(s, [NO_INPUT]);
    expect(s.state).toBe(start);
    expect(s.endTicks).toBe(0);
  });
});
