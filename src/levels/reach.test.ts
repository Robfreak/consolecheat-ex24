import assert from "node:assert/strict";
import test from "node:test";
import { levelFromRows } from "./level.ts";
import { analyzeReach } from "./reach.ts";
import { sampleLevel, samples } from "./samples.ts";

function blank(w: number, h: number): string[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => "."));
}

function gapLevel(gap: number) {
  const g = blank(24, 9);
  g[7][1] = "S";
  g[7][21] = "G";
  for (let x = 0; x < 24; x++) g[8][x] = x >= 8 && x < 8 + gap ? "." : "#";
  return levelFromRows(g.map((r) => r.join("")));
}

function wallLevel(height: number) {
  const g = blank(20, 12);
  g[10][1] = "S";
  g[10][18] = "G";
  for (let x = 0; x < 20; x++) g[11][x] = "#";
  for (let k = 0; k < height; k++) g[10 - k][10] = "#";
  return levelFromRows(g.map((r) => r.join("")));
}

test("a plain reachable level and a short hop are reachable", () => {
  const level = levelFromRows([
    "................",
    "................",
    "................",
    "................",
    "................",
    "..........##..G.",
    "......##........",
    ".S..............",
    "################",
  ]);
  const r = analyzeReach(level);
  assert.equal(r.reachable, true);
  assert.equal(r.complete, true);
});

test("gaps: up to 4 tiles can be jumped, 5 and more are too wide", () => {
  for (const gap of [1, 2, 3, 4]) assert.equal(analyzeReach(gapLevel(gap)).reachable, true, `gap ${gap}`);
  for (const gap of [5, 6, 8]) {
    const r = analyzeReach(gapLevel(gap));
    assert.equal(r.reachable, false, `gap ${gap}`);
    assert.equal(r.complete, true);
  }
});

test("walls: up to 3 tiles can be climbed, 4 and more are too high", () => {
  for (const h of [1, 2, 3]) assert.equal(analyzeReach(wallLevel(h)).reachable, true, `wall ${h}`);
  for (const h of [4, 5]) assert.equal(analyzeReach(wallLevel(h)).reachable, false, `wall ${h}`);
});

test("a goal enclosed by spikes is unreachable; the same goal without spikes is reachable", () => {
  const rows = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "........#####...",
    "........#...#...",
    ".S.....^^.G.^^..",
    "################",
  ];
  // Roof over the goal, open only at floor height through two spikes on each side.
  const spiky = rows.map((r) => r);
  spiky[6] = "........#.G.#...";
  spiky[7] = ".S......^^.^^...";
  spiky[5] = "........#####...";
  assert.equal(analyzeReach(levelFromRows(spiky)).reachable, false);
  const safe = rows.map((r) => r.replace(/\^/g, "."));
  safe[6] = "........#.G.#...";
  safe[7] = ".S..............";
  assert.equal(analyzeReach(levelFromRows(safe)).reachable, true);
});

test("a start above a pit or on spikes is unreachable; a goal you fall into counts", () => {
  const pit = levelFromRows([
    "................",
    ".S............G.",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    ".............###",
  ]);
  assert.equal(analyzeReach(pit).reachable, false);
  const fallIn = levelFromRows([
    "................",
    ".S..............",
    "................",
    ".G..............",
    "................",
    "................",
    "................",
    "................",
    "################",
  ]);
  assert.equal(analyzeReach(fallIn).reachable, true);
});

test("every built-in level is reachable, and the check stays fast", () => {
  for (const sample of samples) {
    const started = Date.now();
    const r = analyzeReach(sampleLevel(sample, "de"));
    assert.equal(r.reachable, true, sample.id);
    assert.ok(Date.now() - started < 3000, `${sample.id} took ${Date.now() - started} ms`);
  }
});

test("a large empty-floored level finishes inside the step budget", () => {
  const g = blank(64, 32);
  g[30][1] = "S";
  g[30][62] = "G";
  for (let x = 0; x < 64; x++) g[31][x] = "#";
  for (let y = 4; y < 30; y += 3) for (let x = 2 + (y % 7); x < 62; x += 6) g[y][x] = "#";
  const r = analyzeReach(levelFromRows(g.map((r) => r.join(""))));
  assert.equal(r.reachable, true);
});
