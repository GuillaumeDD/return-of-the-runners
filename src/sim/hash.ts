import type { GameState, MonkMode, PlayerMode, Status } from "./state";

const STATUS_CODE: Readonly<Record<Status, number>> = { playing: 0, dead: 1, won: 2 };
const MONK_MODE_CODE: Readonly<Record<MonkMode, number>> = {
  free: 0,
  trapped: 1,
  escaping: 2,
  dead: 3,
};

const PLAYER_MODE_CODE: Readonly<Record<PlayerMode, number>> = { alive: 0, dead: 1, out: 2 };

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * FNV-1a 32-bit hash over a canonical byte serialization of the state. The field order
 * is fixed here, never taken from object key order, so the hash is stable across
 * engines and refactors that reorder properties.
 */
export function hashState(s: GameState): number {
  let h = FNV_OFFSET;
  const byte = (b: number): void => {
    h = Math.imul(h ^ (b & 0xff), FNV_PRIME) >>> 0;
  };
  const int = (n: number): void => {
    const v = n | 0;
    byte(v);
    byte(v >>> 8);
    byte(v >>> 16);
    byte(v >>> 24);
  };

  int(s.tick);
  int(s.rng);
  int(s.width);
  int(s.height);
  for (const row of s.tiles) {
    int(row.length);
    for (let i = 0; i < row.length; i++) int(row.charCodeAt(i));
  }
  int(s.teleports.length);
  for (const link of s.teleports) for (const n of link) int(n);
  int(s.goldLeft);
  int(s.players.length);
  for (const p of s.players) {
    int(p.x);
    int(p.y);
    int(p.facing);
    int(p.busy);
    int(p.warp);
    int(PLAYER_MODE_CODE[p.mode]);
    int(p.timer);
    int(p.lives);
    int(p.gold);
    int(p.startX);
    int(p.startY);
    int(p.item === "" ? 0 : p.item.charCodeAt(0));
    int(p.pickHeld ? 1 : 0);
    int(p.useHeld ? 1 : 0);
    int(p.drill ? 1 : 0);
    int(p.bombs.length);
    for (let i = 0; i < p.bombs.length; i++) int(p.bombs.charCodeAt(i));
    int(p.bombHeld ? 1 : 0);
  }
  int(s.holes.length);
  for (const h of s.holes) {
    int(h.cx);
    int(h.cy);
    int(h.age);
  }
  int(s.rubble.length);
  for (const r of s.rubble) {
    int(r.cx);
    int(r.y);
    int(r.landed);
  }
  int(s.craters.length);
  for (const c of s.craters) {
    int(c.cx);
    int(c.cy);
    int(c.left);
  }
  int(s.fuses.length);
  for (const f of s.fuses) {
    int(f.cx);
    int(f.cy);
    int(f.big ? 1 : 0);
    int(f.left);
  }
  int(s.blasts.length);
  for (const b of s.blasts) {
    int(b.cx);
    int(b.cy);
    int(b.big ? 1 : 0);
    int(b.age);
  }
  int(s.monks.length);
  for (const m of s.monks) {
    int(m.x);
    int(m.y);
    int(m.facing);
    int(m.busy);
    int(m.warp);
    int(MONK_MODE_CODE[m.mode]);
    int(m.timer);
    int(m.carry);
    int(m.holeX);
    int(m.holeY);
  }
  int(STATUS_CODE[s.status]);
  // When adding a field to GameState, add it here too (hash.test.ts checks each field).

  return h;
}
