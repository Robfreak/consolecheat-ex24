import assert from "node:assert/strict";
import test from "node:test";
import { MAX_H, MAX_W, MIN_H, MIN_W, TILE_GOAL, TILE_SOLID, TILE_START, emptyLevel, levelFromRows } from "./level.ts";
import { sampleLevel, samples } from "./samples.ts";
import { MAX_HASH_LENGTH, base64UrlToBytes, bytesToBase64Url, decodeLevel, decodeTiles, encodeLevel, encodeTiles, isLevelHash } from "./share.ts";

test("encode and decode round-trip every sample, sizes at the limits and the title", () => {
  for (const sample of samples) {
    const level = sampleLevel(sample, "de");
    const hash = encodeLevel(level);
    assert.match(hash, /^lv=1&w=32&h=18&d=[A-Za-z0-9_-]+&t=/);
    const back = decodeLevel(`#${hash}`);
    assert.ok(back.ok);
    if (back.ok) {
      assert.deepEqual([...back.level.tiles], [...level.tiles]);
      assert.equal(back.level.title, sample.de);
    }
  }
  for (const [w, h] of [
    [MIN_W, MIN_H],
    [MAX_W, MAX_H],
  ]) {
    const level = emptyLevel(w, h, "Ä & #=? Titel");
    // A worst case: alternate tiles so every run has length 1.
    for (let i = 0; i < w * (h - 2); i++) level.tiles[i] = i % 2 ? TILE_SOLID : 3;
    const hash = encodeLevel(level);
    assert.ok(hash.length < MAX_HASH_LENGTH, String(hash.length));
    const back = decodeLevel(hash);
    assert.ok(back.ok);
    if (back.ok) {
      assert.deepEqual([...back.level.tiles], [...level.tiles]);
      assert.equal(back.level.title, "Ä & #=? Titel");
    }
  }
  assert.ok(isLevelHash("#lv=1&w=16"));
  assert.ok(!isLevelHash("#datenschutz"));
});

test("base64url and run-length helpers", () => {
  for (const len of [1, 2, 3, 4, 5, 31]) {
    const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37) & 255);
    assert.deepEqual([...(base64UrlToBytes(bytesToBase64Url(bytes)) ?? [])], [...bytes]);
  }
  assert.equal(base64UrlToBytes("a+b/"), null);
  assert.equal(base64UrlToBytes("abcde"), null);
  const tiles = new Uint8Array(100).fill(1);
  assert.equal(encodeTiles(tiles).length, Math.ceil((Math.ceil(100 / 32) * 4) / 3));
  assert.deepEqual([...((decodeTiles(encodeTiles(tiles), 100) as Uint8Array) ?? [])], [...tiles]);
  assert.equal(decodeTiles(encodeTiles(tiles), 99), null, "runs longer than the level");
  assert.equal(decodeTiles(encodeTiles(tiles), 101), null, "runs shorter than the level");
  assert.equal(decodeTiles(bytesToBase64Url(Uint8Array.from([6 << 5])), 1), "tiles");
});

test("every broken, too large or invalid link gets its own error and nothing throws", () => {
  const good = encodeLevel(sampleLevel(samples[0], "en"));
  const params = new URLSearchParams(good);
  const d = params.get("d") as string;
  const cases: [string, string][] = [
    ["", "broken"],
    ["#", "broken"],
    ["#lv", "broken"],
    ["#lv=1", "broken"],
    ["#lv=1&w=32&h=18", "broken"],
    ["#lv=1&w=32&h=18&d=", "broken"],
    [`#lv=1&w=32&h=18&d=${d}!!`, "broken"],
    [`#lv=1&w=32&h=18&d=${d.slice(0, -4)}`, "broken"],
    [`#lv=1&w=32&h=18&d=${d}&d=${d}`, "broken"],
    [`#lv=1&w=x&h=18&d=${d}`, "broken"],
    [`#lv=1&w=32.5&h=18&d=${d}`, "broken"],
    [`#lv=1&w=32&h=18&d=${d}&t=%E0%A4%A`, "broken"],
    [`#lv=abc&w=32&h=18&d=${d}`, "broken"],
    [`#lv=2&w=32&h=18&d=${d}`, "version"],
    [`#lv=0&w=32&h=18&d=${d}`, "version"],
    [`#lv=1&w=15&h=18&d=${d}`, "size"],
    [`#lv=1&w=65&h=18&d=${d}`, "size"],
    [`#lv=1&w=32&h=8&d=${d}`, "size"],
    [`#lv=1&w=32&h=33&d=${d}`, "size"],
    [`#lv=1&w=32&h=18&d=${d}&t=${"x".repeat(MAX_HASH_LENGTH)}`, "tooLarge"],
    [`#${"a".repeat(MAX_HASH_LENGTH + 1)}`, "tooLarge"],
  ];
  for (const [hash, error] of cases) {
    const result = decodeLevel(hash);
    assert.equal(result.ok, false, hash.slice(0, 60));
    if (!result.ok) assert.equal(result.error, error, hash.slice(0, 60));
  }
  // Unknown tile code: code 7 in the high bits.
  const bad = new Uint8Array(Math.ceil((32 * 18) / 32));
  bad.fill((1 << 5) | 31);
  bad[0] = (7 << 5) | 31;
  assert.deepEqual(decodeLevel(`#lv=1&w=32&h=18&d=${bytesToBase64Url(bad)}`), { ok: false, error: "tiles" });
  // Start and goal rules.
  const noStart = levelFromRows([
    "................",
    ".......G........",
    "################",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ]);
  assert.deepEqual(decodeLevel(encodeLevel(noStart)), { ok: false, error: "start" });
  const twoStarts = emptyLevel(16, 9);
  twoStarts.tiles[3] = TILE_START;
  assert.deepEqual(decodeLevel(encodeLevel(twoStarts)), { ok: false, error: "start" });
  const noGoal = emptyLevel(16, 9);
  noGoal.tiles[noGoal.tiles.indexOf(TILE_GOAL)] = 0;
  assert.deepEqual(decodeLevel(encodeLevel(noGoal)), { ok: false, error: "goal" });
  // Garbage never throws.
  for (const junk of ["#lv=1&&&", "#=1", "#lv==1", "#lv=1&w=32&h=18&d=%%%", "#\u0000lv=1", "#lv=1&w=999999999&h=1&d=AA"]) {
    assert.doesNotThrow(() => decodeLevel(junk));
    assert.equal(decodeLevel(junk).ok, false);
  }
});

test("titles are cleaned of control characters and markup", () => {
  const level = emptyLevel(16, 9, "");
  const hash = `${encodeLevel(level)}&t=${encodeURIComponent("<b>Hi</b>\u0007 there")}`;
  const back = decodeLevel(hash);
  assert.ok(back.ok);
  if (back.ok) assert.equal(back.level.title, "bHi/b there");
});
