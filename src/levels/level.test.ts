import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  TILE_COIN,
  TILE_GOAL,
  TILE_SOLID,
  TILE_START,
  emptyLevel,
  fillRow,
  findStart,
  levelFromRows,
  levelProblems,
  paint,
  resizeLevel,
  validSize,
} from "./level.ts";
import { samples } from "./samples.ts";

test("exactly one start: painting a start moves it; problems are reported", () => {
  const level = emptyLevel(16, 9);
  assert.deepEqual(levelProblems(level), []);
  paint(level, 8, 3, TILE_START);
  assert.deepEqual(findStart(level), { x: 8, y: 3 });
  assert.equal(level.tiles.filter((t) => t === TILE_START).length, 1);
  paint(level, 8, 3, 0);
  assert.deepEqual(levelProblems(level), ["start"]);
  level.tiles[level.tiles.indexOf(TILE_GOAL)] = 0;
  assert.deepEqual(levelProblems(level), ["start", "goal"]);
  assert.equal(paint(level, -1, 0, TILE_SOLID), false);
  assert.equal(paint(level, 16, 0, TILE_SOLID), false);
});

test("sizes 16–64 by 9–32; resize keeps the bottom-left; fill row", () => {
  assert.ok(validSize(16, 9) && validSize(64, 32) && validSize(32, 18));
  assert.ok(!validSize(15, 9) && !validSize(65, 9) && !validSize(16, 8) && !validSize(16, 33) && !validSize(16.5, 9) && !validSize("16", 9));
  const level = emptyLevel(32, 18);
  const small = resizeLevel(level, 16, 9);
  assert.equal(small.tiles[8 * 16], TILE_SOLID, "the floor stays at the bottom");
  assert.equal(small.tiles[7 * 16 + 2], TILE_START);
  const big = resizeLevel(level, 64, 32);
  assert.equal(big.tiles[31 * 64], TILE_SOLID);
  assert.equal(big.tiles[30 * 64 + 2], TILE_START);
  assert.ok(fillRow(level, 0, TILE_COIN));
  assert.ok(level.tiles.slice(0, 32).every((t) => t === TILE_COIN));
  assert.equal(fillRow(level, 0, TILE_START), false);
});

test("built-in levels: at least 3, 32×18, one start and a goal each", () => {
  assert.ok(samples.length >= 3);
  for (const sample of samples) {
    const level = levelFromRows(sample.rows);
    assert.equal(level.w, 32);
    assert.equal(level.h, 18);
    assert.deepEqual(levelProblems(level), [], sample.id);
    assert.ok(sample.de && sample.en);
  }
  assert.throws(() => levelFromRows(["..", "..."]));
  assert.throws(() => levelFromRows(["x."]));
});

test('JSX keeps spaces before line breaks with {" "} in every component', () => {
  const dir = new URL("./", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
    const text = readFileSync(new URL(file, dir), "utf8");
    assert.doesNotMatch(text, / \n/, `${file}: a trailing space before a JSX line break is dropped; use {" "}`);
    // A text line that ends in a word and continues with a tag on the next line loses its space.
    assert.doesNotMatch(text, /[a-zäöüß,.:]\n\s*<span className="font-mono/i, `${file}: missing {" "} before an inline tag`);
  }
});
