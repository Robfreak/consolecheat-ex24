import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SPRITE_KEY, decodeRuns, parseSprite, readSprite, spriteFrame } from "./sprite.ts";

function spyStorage(values: Record<string, string>) {
  const calls: string[] = [];
  return {
    calls,
    getItem(key: string) {
      calls.push(`get:${key}`);
      return key in values ? values[key] : null;
    },
    setItem(key: string) {
      calls.push(`set:${key}`);
    },
    removeItem(key: string) {
      calls.push(`remove:${key}`);
    },
    clear() {
      calls.push("clear");
    },
  };
}

const red16 = "256:ff0000ff";
const half16 = "128:0,128:00ff00ff";

test("reads the Sprite-Animator draft (ex14 format) with all frames and fps", () => {
  const raw = JSON.stringify({ version: 1, size: 16, frames: [red16, half16], index: 1, fps: 12, palette: "pico8" });
  const store = spyStorage({ [SPRITE_KEY]: raw });
  const result = readSprite(store);
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.sprite.size, 16);
    assert.equal(result.sprite.frames.length, 2);
    assert.equal(result.sprite.fps, 12);
    assert.deepEqual([...result.sprite.frames[0].slice(0, 4)], [255, 0, 0, 255]);
    assert.deepEqual([...result.sprite.frames[1].slice(0, 4)], [0, 0, 0, 0]);
    assert.deepEqual([...result.sprite.frames[1].slice(128 * 4, 128 * 4 + 4)], [0, 255, 0, 255]);
  }
  assert.deepEqual(store.calls, [`get:${SPRITE_KEY}`], "only getItem, never written");
});

test("the sprite key is never written: not when missing, corrupt or blocked", () => {
  for (const values of [{}, { [SPRITE_KEY]: "{oops" }, { [SPRITE_KEY]: JSON.stringify({ version: 2 }) }]) {
    const store = spyStorage(values);
    readSprite(store);
    assert.ok(
      store.calls.every((c) => c.startsWith("get:")),
      store.calls.join(),
    );
  }
  const blocked = {
    getItem() {
      throw new Error("SecurityError");
    },
  };
  assert.deepEqual(readSprite(blocked), { ok: false, reason: "blocked" });
  assert.deepEqual(readSprite(null), { ok: false, reason: "blocked" });
  // No source file writes the sprite key.
  for (const file of ["sprite.ts", "storage.ts", "LevelEditor.tsx", "App.tsx", "legal.tsx"]) {
    const text = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(
      text,
      /setItem\(\s*SPRITE_KEY|removeItem\(\s*SPRITE_KEY|setItem\(\s*["']consolecheat-sprite-v1|removeItem\(\s*["']consolecheat-sprite-v1/,
      file,
    );
  }
});

test("a missing or corrupt sprite falls back (default character)", () => {
  assert.deepEqual(parseSprite(null), { ok: false, reason: "missing" });
  const bad = [
    "not json",
    "null",
    "[]",
    JSON.stringify({ version: 1, size: 20, frames: [red16] }),
    JSON.stringify({ version: 1, size: 16, frames: [] }),
    JSON.stringify({ version: 1, size: 16, frames: ["255:ff0000ff"] }),
    JSON.stringify({ version: 1, size: 16, frames: ["257:ff0000ff"] }),
    JSON.stringify({ version: 1, size: 16, frames: ["256:ff00"] }),
    JSON.stringify({ version: 1, size: 16, frames: [red16, 5] }),
    JSON.stringify({ version: 1, size: 16, frames: Array(65).fill(red16) }),
    JSON.stringify({ version: 1, size: 16, frames: ["-1:0,257:0"] }),
  ];
  for (const raw of bad) assert.deepEqual(parseSprite(raw), { ok: false, reason: "corrupt" }, raw.slice(0, 40));
  assert.equal(decodeRuns(16, "1e2:0"), null);
  const noFps = parseSprite(JSON.stringify({ version: 1, size: 32, frames: ["1024:0"] }));
  assert.ok(noFps.ok && noFps.sprite.fps === 8);
});

test("frames animate while running and rest on frame 0", () => {
  const sprite = { size: 16, frames: [new Uint8ClampedArray(1024), new Uint8ClampedArray(1024), new Uint8ClampedArray(1024)], fps: 6 };
  assert.equal(spriteFrame(sprite, 500, false), 0);
  assert.equal(spriteFrame(sprite, 0, true), 0);
  assert.equal(spriteFrame(sprite, 20, true), 1);
  assert.equal(spriteFrame(sprite, 40, true), 2);
  assert.equal(spriteFrame(sprite, 60, true), 0);
});
