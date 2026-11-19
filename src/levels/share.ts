// Level links. Everything lives after the #, which never reaches the server.
//
//   #lv=1&w=32&h=18&d=<tiles>&t=<title>
//
// `d` is a run-length encoding packed into bytes and written as base64url:
// one byte per run, high 3 bits = tile code (0 empty, 1 solid, 2 spikes, 3 coin,
// 4 start, 5 goal), low 5 bits = run length - 1 (1..32). The runs must cover
// exactly w×h tiles, row by row from the top left.

import { MAX_H, MAX_W, MIN_H, MIN_W, TITLE_MAX, cleanTitle, isTile, levelProblems, validSize, type Level } from "./level.ts";

export const LINK_VERSION = 1;
/** The whole hash (without #) may be at most this long. */
export const MAX_HASH_LENGTH = 8192;
const RUN_MAX = 32;

export type LinkError = "version" | "broken" | "tooLarge" | "size" | "tiles" | "start" | "goal";
export type LinkResult = { ok: true; level: Level } | { ok: false; error: LinkError };

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function bytesToBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

export function base64UrlToBytes(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const chunk = text.slice(i, i + 4);
    let n = 0;
    for (let k = 0; k < 4; k++) n = (n << 6) | (k < chunk.length ? B64.indexOf(chunk[k]) : 0);
    out.push((n >> 16) & 255);
    if (chunk.length > 2) out.push((n >> 8) & 255);
    if (chunk.length > 3) out.push(n & 255);
  }
  return Uint8Array.from(out);
}

export function encodeTiles(tiles: Uint8Array): string {
  const runs: number[] = [];
  let i = 0;
  while (i < tiles.length) {
    const t = tiles[i];
    let n = 1;
    while (i + n < tiles.length && tiles[i + n] === t && n < RUN_MAX) n++;
    runs.push((t << 5) | (n - 1));
    i += n;
  }
  return bytesToBase64Url(Uint8Array.from(runs));
}

/** null: broken data; "tiles": an unknown tile code. */
export function decodeTiles(text: string, count: number): Uint8Array | "tiles" | null {
  const bytes = base64UrlToBytes(text);
  if (!bytes || bytes.length === 0) return null;
  const tiles = new Uint8Array(count);
  let at = 0;
  for (const byte of bytes) {
    const t = byte >> 5;
    const n = (byte & 31) + 1;
    if (!isTile(t)) return "tiles";
    if (at + n > count) return null;
    tiles.fill(t, at, at + n);
    at += n;
  }
  return at === count ? tiles : null;
}

export function encodeLevel(level: Level): string {
  const params = [`lv=${LINK_VERSION}`, `w=${level.w}`, `h=${level.h}`, `d=${encodeTiles(level.tiles)}`];
  const title = cleanTitle(level.title);
  if (title) params.push(`t=${encodeURIComponent(title)}`);
  return params.join("&");
}

export function isLevelHash(hash: string): boolean {
  return /^#?lv=/.test(hash);
}

function strictInt(value: string | undefined): number | null {
  if (value === undefined || !/^\d{1,3}$/.test(value)) return null;
  return Number(value);
}

/** Never throws. Checks length, version, size, tile codes, one start and at least one goal. */
export function decodeLevel(hash: string): LinkResult {
  const raw = hash.replace(/^#/, "");
  if (raw.length > MAX_HASH_LENGTH) return { ok: false, error: "tooLarge" };
  const params = new Map<string, string>();
  for (const part of raw.split("&")) {
    const eq = part.indexOf("=");
    if (eq <= 0) return { ok: false, error: "broken" };
    const key = part.slice(0, eq);
    if (params.has(key)) return { ok: false, error: "broken" };
    params.set(key, part.slice(eq + 1));
  }
  if (params.get("lv") !== String(LINK_VERSION))
    return { ok: false, error: params.has("lv") && /^\d+$/.test(params.get("lv") ?? "") ? "version" : "broken" };
  const w = strictInt(params.get("w"));
  const h = strictInt(params.get("h"));
  if (w === null || h === null) return { ok: false, error: "broken" };
  if (!validSize(w, h)) return { ok: false, error: "size" };
  const d = params.get("d");
  if (!d) return { ok: false, error: "broken" };
  const tiles = decodeTiles(d, w * h);
  if (tiles === null) return { ok: false, error: "broken" };
  if (tiles === "tiles") return { ok: false, error: "tiles" };
  let title = "";
  const t = params.get("t");
  if (t !== undefined) {
    try {
      title = cleanTitle(decodeURIComponent(t));
    } catch {
      return { ok: false, error: "broken" };
    }
  }
  const level: Level = { w, h, tiles, title };
  const problems = levelProblems(level);
  if (problems.includes("start")) return { ok: false, error: "start" };
  if (problems.includes("goal")) return { ok: false, error: "goal" };
  return { ok: true, level };
}

export const LINK_LIMITS = { MIN_W, MAX_W, MIN_H, MAX_H, MAX_HASH_LENGTH, TITLE_MAX };
