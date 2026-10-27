import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { LIMITS, TILE, type Level } from "../../src/level/format";
import { parseLevel } from "../../src/level/parse";
import firstSteps from "../../src/levels/first-steps.json?raw";
import {
  MAX_SHARE_PAYLOAD,
  decodeLevel,
  encodeLevel,
  fromBase64url,
  inflate,
  toBase64url,
} from "../../src/share/link";
import { makeRng, randInt } from "../helpers/rng";
import { loadFixtures } from "../level/fixtures";
import { expectLevelInvariants } from "../level/invariants";

const ITERATIONS = 2000;

function parsed(text: string): Level {
  const r = parseLevel(text);
  if (!r.ok) throw new Error(r.errors.map((e) => e.code).join());
  return r.level;
}

function codes(r: Awaited<ReturnType<typeof decodeLevel>>): string[] {
  return r.ok ? [] : r.errors.map((e) => e.code);
}

const NAME_CHARS = [...Array.from("abcXYZ019 -_'!éàçœ黄金"), "🏃", "💰"];
const FILL = [TILE.empty, TILE.brick, TILE.bedrock, TILE.ladder, TILE.bar, TILE.gold, TILE.exit];

/** A random playable level: any size, any tiles, one runner, gold, an exit, ≤ 16 monks. */
function randomLevel(rng: () => number, size?: { width: number; height: number }): Level {
  const width =
    size?.width ?? LIMITS.minWidth + randInt(rng, LIMITS.maxWidth - LIMITS.minWidth + 1);
  const height =
    size?.height ?? LIMITS.minHeight + randInt(rng, LIMITS.maxHeight - LIMITS.minHeight + 1);
  const cells: string[] = Array.from(
    { length: width * height },
    () => FILL[randInt(rng, FILL.length)] ?? ".",
  );
  // Distinct cells for the runner, one gold, one exit and the monks.
  const spots = [...cells.keys()].sort(() => rng() - 0.5);
  const monks = randInt(rng, LIMITS.maxMonks + 1);
  const special = [
    TILE.runnerStart,
    TILE.gold,
    TILE.exit,
    ...Array<string>(monks).fill(TILE.monkStart),
  ];
  special.forEach((tile, i) => (cells[spots[i] ?? 0] = tile));
  const grid = Array.from({ length: height }, (_, y) =>
    cells.slice(y * width, (y + 1) * width).join(""),
  );
  let name = "";
  const nameLength = 1 + randInt(rng, LIMITS.maxNameLength);
  for (let i = 0; i < nameLength; i++) name += NAME_CHARS[randInt(rng, NAME_CHARS.length)] ?? "a";
  name = name.trim() === "" ? "x" : name.trim();
  return parsed(
    JSON.stringify({
      format: "return-of-the-runners/level",
      version: 2,
      name,
      width,
      height,
      grid,
    }),
  );
}

describe("round trip", () => {
  it("decoding a level's payload gives the level back: bundled level and every fixture", async () => {
    for (const level of [parsed(firstSteps), ...loadFixtures("valid").map((f) => parsed(f.text))]) {
      const back = await decodeLevel(await encodeLevel(level));
      expect(back.ok && back.level).toEqual(level);
    }
  });

  it("2,000 random valid levels come back equal", async () => {
    const rng = makeRng(17);
    for (let i = 0; i < ITERATIONS; i++) {
      const level = randomLevel(rng);
      const back = await decodeLevel(await encodeLevel(level));
      expect(back.ok && back.level).toEqual(level);
    }
  });

  it("the bundled level's link is under 1,000 characters; the largest level fits the cap", async () => {
    expect((await encodeLevel(parsed(firstSteps))).length).toBeLessThan(1000);
    const rng = makeRng(3);
    const largest = randomLevel(rng, { width: LIMITS.maxWidth, height: LIMITS.maxHeight });
    const big = { ...largest, name: "💰".repeat(LIMITS.maxNameLength) };
    expect((await encodeLevel(big)).length).toBeLessThan(MAX_SHARE_PAYLOAD);
  });

  it("a v2 payload decodes and encodes back to the same payload, teleporters included", async () => {
    for (const f of loadFixtures("valid", "v2")) {
      const payload = await encodeLevel(parsed(f.text));
      const back = await decodeLevel(payload);
      if (!back.ok) throw new Error(f.file);
      expect(await encodeLevel(back.level), f.file).toBe(payload);
    }
  });

  it("a v1 link opens as the level's v2 migration", async () => {
    for (const f of loadFixtures("valid", "v1")) {
      const v1Payload = toBase64url(deflateRawSync(JSON.stringify(JSON.parse(f.text))));
      const back = await decodeLevel(v1Payload);
      expect(back.ok && back.level, f.file).toEqual(parsed(f.text));
      expect(back.ok && back.level.version).toBe(2);
      // Shared again, it is a v2 link.
      if (back.ok) expect(await encodeLevel(back.level)).not.toBe(v1Payload);
    }
  });

  it("payloads use only URL-safe characters, with no padding", async () => {
    expect(await encodeLevel(parsed(firstSteps))).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("base64url", () => {
  it("matches Node's encoder and decodes back, for random bytes of every length mod 3", () => {
    const rng = makeRng(5);
    for (let i = 0; i < 500; i++) {
      const bytes = Uint8Array.from({ length: randInt(rng, 40) }, () => randInt(rng, 256));
      const text = toBase64url(bytes);
      expect(text).toBe(Buffer.from(bytes).toString("base64url"));
      expect(fromBase64url(text)).toEqual(bytes);
    }
  });

  // Regression (self-review): "AB" and "AA" both decoded to the byte 0.
  it("rejects other characters, padding, a lone last character and non-zero spare bits", () => {
    expect(fromBase64url("AA")).toEqual(Uint8Array.of(0));
    for (const bad of ["ab+c", "ab/c", "abc=", "ab c", "abcé", "abcde", "AB", "AAB"]) {
      expect(fromBase64url(bad), bad).toBeNull();
    }
  });
});

describe("rejected payloads", () => {
  it("over the length cap: too-long, before any decoding", async () => {
    expect(codes(await decodeLevel("A".repeat(MAX_SHARE_PAYLOAD + 1)))).toEqual(["too-long"]);
  });

  it("characters outside base64url: not-base64", async () => {
    expect(codes(await decodeLevel("abc$def"))).toEqual(["not-base64"]);
    expect(codes(await decodeLevel("abcd=="))).toEqual(["not-base64"]);
  });

  it("bytes that are not DEFLATE data, or a cut payload: not-deflate", async () => {
    expect(codes(await decodeLevel(toBase64url(Uint8Array.of(0xff, 0xff, 0xff))))).toEqual([
      "not-deflate",
    ]);
    const payload = await encodeLevel(parsed(firstSteps));
    expect(codes(await decodeLevel(payload.slice(0, (payload.length >> 3) << 2)))).toEqual([
      "not-deflate",
    ]);
  });

  it("DEFLATE data that is not a level: the validator's errors", async () => {
    const deflated = (text: string | Buffer): string => toBase64url(deflateRawSync(text));
    expect(codes(await decodeLevel(deflated("hello")))).toEqual(["not-json"]);
    expect(codes(await decodeLevel(deflated(Buffer.of(0x22, 0xc3, 0x28, 0x22))))).toEqual([
      "not-json",
    ]); // not UTF-8
    const noGold = firstSteps.replaceAll("$", ".");
    expect(codes(await decodeLevel(deflated(noGold)))).toEqual(["no-gold"]);
  });

  // The payload cap bounds a bomb to ~12 MB of output; only the first 64 KB are kept.
  it("a zip bomb (10 MB of output from a payload under the cap): too-large", async () => {
    const bomb = deflateRawSync(Buffer.alloc(10 * 1024 * 1024, 0x20)); // 10 MB of spaces
    const payload = toBase64url(bomb);
    expect(payload.length).toBeLessThanOrEqual(MAX_SHARE_PAYLOAD);
    expect(codes(await decodeLevel(payload))).toEqual(["too-large"]);
    const r = await inflate(bomb, LIMITS.maxInputBytes);
    expect(r).toEqual({ ok: false, error: "too-large" });
  });

  it("exactly at the cap still inflates", async () => {
    const r = await inflate(
      deflateRawSync(Buffer.alloc(LIMITS.maxInputBytes, 0x20)),
      LIMITS.maxInputBytes,
    );
    expect(r.ok && r.bytes.length).toBe(LIMITS.maxInputBytes);
  });
});

describe("decodeLevel fuzzing", () => {
  async function check(payload: string): Promise<void> {
    const r = await decodeLevel(payload); // rejects would fail the test
    if (r.ok) expectLevelInvariants(r.level);
    else expect(r.errors.length).toBeGreaterThan(0);
  }

  it("2,000 random strings: never throws", async () => {
    const rng = makeRng(11);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=+/%é ";
    for (let i = 0; i < ITERATIONS; i++) {
      let s = "";
      const len = randInt(rng, 300);
      for (let j = 0; j < len; j++) s += alphabet[randInt(rng, alphabet.length)] ?? "";
      await check(s);
    }
  });

  it("2,000 mutations of a valid payload: never throws, anything accepted is valid", async () => {
    const rng = makeRng(12);
    const payload = await encodeLevel(parsed(firstSteps));
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    for (let i = 0; i < ITERATIONS; i++) {
      const at = randInt(rng, payload.length);
      const ch = alphabet[randInt(rng, alphabet.length)] ?? "A";
      const mutated = [
        payload.slice(0, at) + ch + payload.slice(at + 1), // replace one character
        payload.slice(0, at) + payload.slice(at + 1), // drop one
        payload.slice(0, at) + ch + payload.slice(at), // insert one
        payload.slice(0, at), // cut
      ][randInt(rng, 4)];
      await check(mutated ?? payload);
    }
  });
});
