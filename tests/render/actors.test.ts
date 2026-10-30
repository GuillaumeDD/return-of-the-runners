import { describe, expect, it } from "vitest";
import {
  MONK_ANIMS,
  type Motion,
  monkPose,
  playerPose,
  poseSprite,
  RUNNER_ANIMS,
  STILL_AFTER,
  trackMotion,
} from "../../src/render/actors";
import { SPRITES } from "../../src/render/sheet";
import { frameKey } from "../../src/render/sprites";
import { SUB } from "../../src/sim/rules";
import type { GameState, MonkMode } from "../../src/sim/state";
import { atCell, stateFrom, withPlayer } from "../sim/helpers";

// A floor, a ladder at column 1, a bar at (2, 0), open air at (3, 0); a monk at (4, 1).
const ROWS = [".H-..", "PH..M", "#####"];

function base(): GameState {
  return stateFrom(ROWS);
}

function at(s: GameState, tick: number): GameState {
  return { ...s, tick };
}

/** The motion record of a player who has just taken a step. */
function walked(s: GameState): Motion {
  const before = trackMotion(null, at(s, s.tick - 1));
  const p = s.players[0];
  if (p === undefined) throw new Error("no player");
  return trackMotion(before, withPlayer(s, { x: p.x + 1 }));
}

describe("playerPose: each simulation action maps to one animation", () => {
  it("standing on the floor, never seen moving: idle, still", () => {
    const pose = playerPose(base(), null, 0);
    expect(pose.anim).toBe(RUNNER_ANIMS.idle);
    expect(pose.moving).toBe(false);
    expect(pose.kind).toBe("runner1");
  });

  it("having just stepped on the floor: run, moving", () => {
    const s = at(base(), 10);
    const moved = withPlayer(s, { x: (s.players[0]?.x ?? 0) + 1 });
    const pose = playerPose(moved, walked(s), 0);
    expect(pose.anim).toBe(RUNNER_ANIMS.run);
    expect(pose.moving).toBe(true);
  });

  it("on a ladder: climb; on a bar: bar; in the air: fall", () => {
    expect(playerPose(atCell(base(), 1, 0), null, 0).anim).toBe(RUNNER_ANIMS.climb);
    expect(playerPose(atCell(base(), 2, 0), null, 0).anim).toBe(RUNNER_ANIMS.bar);
    expect(playerPose(atCell(base(), 3, 0), null, 0).anim).toBe(RUNNER_ANIMS.fall);
  });

  it("between two rows of a ladder: climb", () => {
    expect(playerPose(withPlayer(base(), { x: SUB, y: SUB / 2 }), null, 0).anim).toBe(
      RUNNER_ANIMS.climb,
    );
  });

  it("busy (digging, swinging, firing): dig; drilling: drill; dead: die", () => {
    expect(playerPose(withPlayer(base(), { busy: 5 }), null, 0).anim).toBe(RUNNER_ANIMS.dig);
    expect(playerPose(withPlayer(base(), { busy: 5, drill: true }), null, 0).anim).toBe(
      RUNNER_ANIMS.drill,
    );
    expect(playerPose(withPlayer(base(), { mode: "dead" }), null, 0).anim).toBe(RUNNER_ANIMS.die);
  });

  it("player 2 is drawn as runner 2", () => {
    expect(playerPose(stateFrom(["PQ", "##"], 1, 2), null, 1).kind).toBe("runner2");
  });
});

describe("monkPose", () => {
  it.each<[MonkMode, keyof typeof MONK_ANIMS]>([
    ["trapped", "trapped"],
    ["escaping", "escaping"],
    ["snared", "snared"],
    ["dazed", "dazed"],
  ])("a %s monk shows the %s animation", (mode, action) => {
    const s = base();
    const monks = s.monks.map((m) => ({ ...m, mode }));
    expect(monkPose({ ...s, monks }, null, 0).anim).toBe(MONK_ANIMS[action]);
  });

  it("a free monk moves like the runner: idle on the floor, climb on a ladder", () => {
    const s = base();
    expect(monkPose(s, null, 0).anim).toBe(MONK_ANIMS.idle);
    const onLadder = { ...s, monks: s.monks.map((m) => ({ ...m, x: SUB, y: 0 })) };
    expect(monkPose(onLadder, null, 0).anim).toBe(MONK_ANIMS.climb);
  });
});

describe("trackMotion", () => {
  it("keeps an actor moving for STILL_AFTER ticks after its last step, then still", () => {
    const s = at(base(), 100);
    const stepped = withPlayer(s, { x: (s.players[0]?.x ?? 0) + 1 });
    let motion = trackMotion(trackMotion(null, s), stepped);
    for (let t = 1; t <= STILL_AFTER; t++) {
      motion = trackMotion(motion, at(stepped, 100 + t));
      expect(playerPose(at(stepped, 100 + t), motion, 0).anim).toBe(RUNNER_ANIMS.run);
    }
    const later = at(stepped, 101 + STILL_AFTER);
    expect(playerPose(later, trackMotion(motion, later), 0).anim).toBe(RUNNER_ANIMS.idle);
  });

  it("counts a first sighting, or a restarted level, as still", () => {
    const s = at(base(), 50);
    expect(playerPose(s, trackMotion(null, s), 0).moving).toBe(false);
    const motion = walked(s);
    const restarted = withPlayer(at(base(), 0), { x: 3 });
    expect(playerPose(restarted, trackMotion(motion, restarted), 0).anim).toBe(RUNNER_ANIMS.idle);
  });
});

describe("poseSprite", () => {
  const climbing = playerPose(atCell(base(), 1, 0), null, 0);

  it("loops the frame index within the animation's length", () => {
    const moving = { ...climbing, moving: true };
    const seen = new Set<string>();
    for (let t = 0; t < 5000; t += 13) seen.add(poseSprite(moving, t));
    const all = Array.from(
      { length: RUNNER_ANIMS.climb.frames },
      (_, f) => `runner1/${frameKey(RUNNER_ANIMS.climb, f)}`,
    );
    expect([...seen].sort()).toEqual(all.sort());
  });

  it("holds the first frame while the actor stands still", () => {
    for (const t of [0, 123, 4567]) expect(poseSprite(climbing, t)).toBe("runner1/climb:0");
  });

  it("does not depend on facing: the renderer mirrors the same frames", () => {
    const moving = { ...climbing, moving: true };
    for (const t of [0, 99, 250]) {
      expect(poseSprite({ ...moving, facing: -1 }, t)).toBe(
        poseSprite({ ...moving, facing: 1 }, t),
      );
    }
  });
});

describe("SPRITES", () => {
  it("has every frame of every animation, for both runners and the monks", () => {
    const keys = new Set(SPRITES.map((s) => s.key));
    for (const kind of ["runner1", "runner2"]) {
      for (const a of Object.values(RUNNER_ANIMS)) {
        for (let f = 0; f < a.frames; f++) expect(keys).toContain(`${kind}/${frameKey(a, f)}`);
      }
    }
    for (const a of Object.values(MONK_ANIMS)) {
      for (let f = 0; f < a.frames; f++) expect(keys).toContain(`monk/${frameKey(a, f)}`);
    }
  });

  it("has no two sprites with the same key", () => {
    expect(new Set(SPRITES.map((s) => s.key)).size).toBe(SPRITES.length);
  });
});
