// Browser side of e2e/share.spec.ts: share links encoded and decoded by the page's own
// engine (its CompressionStream and DecompressionStream), with the game's build
// settings. Never deployed.
import { parseLevel } from "../src/level/parse";
import { decodeLevel, encodeLevel } from "../src/share/link";
import "./harness-types";

window.shareDecode = async (payload) => {
  const r = await decodeLevel(payload);
  return r.ok ? { ok: true, level: r.level } : { ok: false, codes: r.errors.map((e) => e.code) };
};
window.shareEncode = async (levelText) => {
  const r = parseLevel(levelText);
  if (!r.ok) throw new Error(r.errors.map((e) => e.code).join());
  return encodeLevel(r.level);
};
