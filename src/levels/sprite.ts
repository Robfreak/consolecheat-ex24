// Optional player sprite from the Sprite-Animator (Robfreak/consolecheat-ex14).
// Same origin (robfreak.github.io), so the draft is in this browser's localStorage.
// Read-only: only getItem is ever called on this key. It is never written or removed.
//
//   consolecheat-sprite-v1 = { "version": 1, "size": 16|32|64,
//     "frames": ["<runs>", …] (1–64), "index": n, "fps": 1–24, … }
//
// Runs: comma separated `COUNT:0` (transparent) or `COUNT:RRGGBBAA`, covering exactly size×size pixels.
// The sprite only changes the look. The hitbox stays 12×14 px.

export const SPRITE_KEY = "consolecheat-sprite-v1";
const SIZES = [16, 32, 64];
const MAX_FRAMES = 64;

export type SpriteFrames = { size: number; frames: Uint8ClampedArray[]; fps: number };
export type SpriteResult = { ok: true; sprite: SpriteFrames } | { ok: false; reason: "missing" | "blocked" | "corrupt" };

export function decodeRuns(size: number, text: string, maxLength = 200_000): Uint8ClampedArray | null {
  const count = size * size;
  if (typeof text !== "string" || text.length === 0 || text.length > maxLength) return null;
  const out = new Uint8ClampedArray(count * 4);
  let written = 0;
  for (const run of text.split(",")) {
    const sep = run.indexOf(":");
    if (sep <= 0) return null;
    const head = run.slice(0, sep);
    if (!/^\d+$/.test(head)) return null;
    const n = Number(head);
    const payload = run.slice(sep + 1);
    if (n < 1 || written + n > count) return null;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    if (payload !== "0") {
      if (!/^[0-9a-fA-F]{8}$/.test(payload)) return null;
      r = parseInt(payload.slice(0, 2), 16);
      g = parseInt(payload.slice(2, 4), 16);
      b = parseInt(payload.slice(4, 6), 16);
      a = parseInt(payload.slice(6, 8), 16);
    }
    for (let k = 0; k < n; k++) {
      const o = (written + k) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = a;
    }
    written += n;
  }
  return written === count ? out : null;
}

/** Never throws. All frames must decode, or the sprite counts as corrupt. */
export function parseSprite(raw: string | null): SpriteResult {
  if (raw === null) return { ok: false, reason: "missing" };
  if (raw.length > 2_000_000) return { ok: false, reason: "corrupt" };
  try {
    const data = JSON.parse(raw) as Record<string, unknown> | null;
    if (!data || typeof data !== "object" || Array.isArray(data) || data.version !== 1) return { ok: false, reason: "corrupt" };
    const size = data.size;
    if (typeof size !== "number" || !SIZES.includes(size)) return { ok: false, reason: "corrupt" };
    if (!Array.isArray(data.frames) || data.frames.length < 1 || data.frames.length > MAX_FRAMES) return { ok: false, reason: "corrupt" };
    const frames: Uint8ClampedArray[] = [];
    for (const frame of data.frames) {
      if (typeof frame !== "string") return { ok: false, reason: "corrupt" };
      const pixels = decodeRuns(size, frame);
      if (!pixels) return { ok: false, reason: "corrupt" };
      frames.push(pixels);
    }
    const fps = typeof data.fps === "number" && Number.isFinite(data.fps) ? Math.min(24, Math.max(1, Math.round(data.fps))) : 8;
    return { ok: true, sprite: { size, frames, fps } };
  } catch {
    return { ok: false, reason: "corrupt" };
  }
}

/** getItem only; never setItem or removeItem. A blocked storage is reported, not thrown. */
export function readSprite(storage: Pick<Storage, "getItem"> | null): SpriteResult {
  if (!storage) return { ok: false, reason: "blocked" };
  let raw: string | null;
  try {
    raw = storage.getItem(SPRITE_KEY);
  } catch {
    return { ok: false, reason: "blocked" };
  }
  return parseSprite(raw);
}

/** Which frame to show: frame 0 while standing, cycling at the sprite's fps while running. */
export function spriteFrame(sprite: SpriteFrames, runTicks: number, running: boolean, hz = 120): number {
  if (!running || sprite.frames.length === 1) return 0;
  return Math.floor((runTicks / hz) * sprite.fps) % sprite.frames.length;
}
