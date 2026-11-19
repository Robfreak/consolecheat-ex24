// Level model: a tile grid. Pure data and helpers so node:test can check them.

export const TILE_EMPTY = 0;
export const TILE_SOLID = 1;
export const TILE_SPIKE = 2;
export const TILE_COIN = 3;
export const TILE_START = 4;
export const TILE_GOAL = 5;
export const TILE_CODES = [TILE_EMPTY, TILE_SOLID, TILE_SPIKE, TILE_COIN, TILE_START, TILE_GOAL] as const;
export type Tile = (typeof TILE_CODES)[number];

export const MIN_W = 16;
export const MAX_W = 64;
export const MIN_H = 9;
export const MAX_H = 32;
export const DEFAULT_W = 32;
export const DEFAULT_H = 18;
export const TITLE_MAX = 40;

export type Level = { w: number; h: number; tiles: Uint8Array; title: string };
export type LevelProblem = "start" | "goal";

export function isTile(value: number): value is Tile {
  return Number.isInteger(value) && value >= TILE_EMPTY && value <= TILE_GOAL;
}

export function validSize(w: unknown, h: unknown): boolean {
  return (
    typeof w === "number" &&
    typeof h === "number" &&
    Number.isInteger(w) &&
    Number.isInteger(h) &&
    w >= MIN_W &&
    w <= MAX_W &&
    h >= MIN_H &&
    h <= MAX_H
  );
}

export function cleanTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .trim()
    .slice(0, TITLE_MAX);
}

export function emptyLevel(w = DEFAULT_W, h = DEFAULT_H, title = ""): Level {
  const tiles = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) tiles[(h - 1) * w + x] = TILE_SOLID;
  tiles[(h - 2) * w + 2] = TILE_START;
  tiles[(h - 2) * w + w - 3] = TILE_GOAL;
  return { w, h, tiles, title };
}

export function tileAt(level: Level, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return -1;
  return level.tiles[y * level.w + x];
}

export function findStart(level: Level): { x: number; y: number } | null {
  const i = level.tiles.indexOf(TILE_START);
  return i < 0 ? null : { x: i % level.w, y: Math.floor(i / level.w) };
}

export function countTiles(level: Level, tile: Tile): number {
  let n = 0;
  for (const t of level.tiles) if (t === tile) n++;
  return n;
}

/** Exactly one start and at least one goal. */
export function levelProblems(level: Level): LevelProblem[] {
  const problems: LevelProblem[] = [];
  if (countTiles(level, TILE_START) !== 1) problems.push("start");
  if (countTiles(level, TILE_GOAL) < 1) problems.push("goal");
  return problems;
}

export function cloneLevel(level: Level): Level {
  return { w: level.w, h: level.h, tiles: new Uint8Array(level.tiles), title: level.title };
}

/** Paints one tile. A start replaces the old start, so there is never more than one. */
export function paint(level: Level, x: number, y: number, tile: Tile): boolean {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return false;
  const i = y * level.w + x;
  if (level.tiles[i] === tile) return false;
  if (tile === TILE_START) {
    const old = level.tiles.indexOf(TILE_START);
    if (old >= 0) level.tiles[old] = TILE_EMPTY;
  }
  level.tiles[i] = tile;
  return true;
}

/** Fills one row with a tile (start is never used for a row). */
export function fillRow(level: Level, y: number, tile: Tile): boolean {
  if (tile === TILE_START || y < 0 || y >= level.h) return false;
  let changed = false;
  for (let x = 0; x < level.w; x++) {
    const i = y * level.w + x;
    if (level.tiles[i] !== tile) {
      level.tiles[i] = tile;
      changed = true;
    }
  }
  return changed;
}

/** New size, anchored bottom-left so the floor stays the floor. */
export function resizeLevel(level: Level, w: number, h: number): Level {
  const next = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = y + (level.h - h);
    if (sy < 0 || sy >= level.h) continue;
    for (let x = 0; x < Math.min(w, level.w); x++) next[y * w + x] = level.tiles[sy * level.w + x];
  }
  return { w, h, tiles: next, title: level.title };
}

const CHARS: Record<string, Tile> = { ".": TILE_EMPTY, "#": TILE_SOLID, "^": TILE_SPIKE, o: TILE_COIN, S: TILE_START, G: TILE_GOAL };

/** Builds a level from rows of `.#^oSG`. Used for the built-in levels and tests. */
export function levelFromRows(rows: readonly string[], title = ""): Level {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const tiles = new Uint8Array(w * h);
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`row ${y} has ${row.length} tiles, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const tile = CHARS[row[x]];
      if (tile === undefined) throw new Error(`unknown tile ${row[x]}`);
      tiles[y * w + x] = tile;
    }
  });
  return { w, h, tiles, title };
}
