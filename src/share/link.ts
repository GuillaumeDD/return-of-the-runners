import { LIMITS, type Level, type LevelErrorCode, type ParseResult } from "../level/format";
import { parseLevel } from "../level/parse";
import { levelDocument } from "../level/serialize";

/**
 * Share links: a level in the URL fragment (`#level=<payload>`), so sharing needs no
 * server. The payload is the level's compact v2 JSON (a v1 payload still opens,
 * migrated), compressed with raw DEFLATE (`CompressionStream("deflate-raw")`, built
 * into every browser and Node) and written in base64url. Decoding is untrusted input: each step has a cap, and the result goes
 * through the full validator, like an imported file.
 */

/** Longest payload accepted (characters); longer ones are never decoded. */
export const MAX_SHARE_PAYLOAD = 16 * 1024;

/**
 * Compressed bytes are fed to the decompressor this many at a time, so in engines whose
 * decompressor follows backpressure a "zip bomb" (a small payload that inflates to
 * megabytes) is stopped soon after the output passes the cap. Either way, DEFLATE
 * expands at most about 1,032:1, so the payload cap bounds the worst case to about
 * 12 MB of work, and no more than the cap is ever kept.
 */
export const INFLATE_SLICE = 256;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE64URL = /^[A-Za-z0-9_-]*$/;

/** The share payload of a level (no padding, URL-safe). */
export async function encodeLevel(level: Level): Promise<string> {
  const json = JSON.stringify(levelDocument(level));
  const compressed = new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return toBase64url(new Uint8Array(await new Response(compressed).arrayBuffer()));
}

/** The level in a share payload, or why there is none. Never rejects. */
export async function decodeLevel(payload: string): Promise<ParseResult> {
  if (payload.length > MAX_SHARE_PAYLOAD) return fail("too-long", "payload over the cap");
  const bytes = fromBase64url(payload);
  if (bytes === null) return fail("not-base64", "not base64url");
  const inflated = await inflate(bytes, LIMITS.maxInputBytes);
  if (!inflated.ok) {
    return inflated.error === "too-large"
      ? fail("too-large", "inflates past the cap")
      : fail("not-deflate", "not raw DEFLATE data");
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(inflated.bytes);
  } catch {
    return fail("not-json", "not UTF-8");
  }
  return parseLevel(text);
}

function fail(code: LevelErrorCode, detail: string): ParseResult {
  return { ok: false, errors: [{ code, detail }] };
}

export function toBase64url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let k = 0; k < chars; k++) out += ALPHABET.charAt((n >> (18 - 6 * k)) & 63);
  }
  return out;
}

/** Bytes of base64url text without padding; null if it is not some. */
export function fromBase64url(text: string): Uint8Array | null {
  // A final group of one character cannot hold a byte.
  if (!BASE64URL.test(text) || text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 6) / 8));
  let bits = 0;
  let value = 0;
  let j = 0;
  for (const ch of text) {
    value = ((value << 6) | ALPHABET.indexOf(ch)) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j++] = (value >> bits) & 0xff;
    }
  }
  // Unused low bits in the last character must be zero: one text per byte string.
  if ((value & ((1 << bits) - 1)) !== 0) return null;
  return out;
}

export type Inflated =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly error: "not-deflate" | "too-large" };

/** Inflates raw DEFLATE data, giving up as soon as the output passes `cap` bytes. */
export async function inflate(bytes: Uint8Array, cap: number): Promise<Inflated> {
  let consumed = 0;
  // Pulled a slice at a time: the decompressor only gets more input once it wants it.
  const input = new ReadableStream<BufferSource>({
    pull(controller) {
      if (consumed >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(consumed, consumed + INFLATE_SLICE));
      consumed += INFLATE_SLICE;
    },
  });
  const reader = input.pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > cap) {
        reader.cancel().catch(() => undefined);
        return { ok: false, error: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, error: "not-deflate" };
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return { ok: true, bytes: out };
}
