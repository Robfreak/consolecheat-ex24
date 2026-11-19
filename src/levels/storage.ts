// Own data under one key. The sprite draft is read elsewhere (sprite.ts) and never written.
//
//   consolecheat-levels-v1 = {
//     "schema": "consolecheat-levels", "version": 1,
//     "best":   { "<level hash>": { "ms": 12345, "coins": 3, "at": "<ISO date>" } },   // at most 200
//     "levels": [ { "id": "<hash>", "title": "…", "link": "lv=1&w=…", "at": "<ISO date>" } ], // at most 50
//     "settings": { "w": 32, "h": 18, "tool": "solid", "sprite": true, "grid": true }
//   }
//
// The level hash is FNV-1a (32 bit, hex) over "w,h,<tile string>", so the same level
// has the same best time whether it came from a sample, a save or a link.

import { DEFAULT_H, DEFAULT_W, TITLE_MAX, cleanTitle, validSize, type Level } from "./level.ts";
import { decodeLevel, encodeTiles } from "./share.ts";

export const STORE_KEY = "consolecheat-levels-v1";
export const LANG_KEY = "consolecheat-lang";
export const THEME_KEY = "consolecheat-theme";
export const SCHEMA = "consolecheat-levels";
export const VERSION = 1;
export const BEST_MAX = 200;
export const LEVELS_MAX = 50;
export const MAX_MS = 1000 * 60 * 60 * 24;
export const TOOLS = ["empty", "solid", "spike", "coin", "start", "goal"] as const;
export type ToolName = (typeof TOOLS)[number];

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type BestEntry = { ms: number; coins: number; at: string };
export type SavedLevel = { id: string; title: string; link: string; at: string };
export type Settings = { w: number; h: number; tool: ToolName; sprite: boolean; grid: boolean };
export type Store = { best: Record<string, BestEntry>; levels: SavedLevel[]; settings: Settings };
export type LoadResult = { store: Store; corrupt: boolean };

export function defaultSettings(): Settings {
  return { w: DEFAULT_W, h: DEFAULT_H, tool: "solid", sprite: true, grid: true };
}

export function emptyStore(): Store {
  return { best: {}, levels: [], settings: defaultSettings() };
}

export function levelHash(level: Level): string {
  const text = `${level.w},${level.h},${encodeTiles(level.tiles)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function plain(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const HASH_RE = /^[0-9a-f]{8}$/;

function validDate(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

function parseBest(value: unknown): BestEntry | null {
  if (!plain(value)) return null;
  const { ms, coins, at } = value;
  if (typeof ms !== "number" || !Number.isInteger(ms) || ms < 0 || ms > MAX_MS) return null;
  if (typeof coins !== "number" || !Number.isInteger(coins) || coins < 0 || coins > 4096) return null;
  if (!validDate(at)) return null;
  return { ms, coins, at };
}

function parseSaved(value: unknown): SavedLevel | null {
  if (!plain(value)) return null;
  const { id, title, link, at } = value;
  if (typeof id !== "string" || !HASH_RE.test(id) || typeof title !== "string" || title.length > TITLE_MAX) return null;
  if (typeof link !== "string" || !validDate(at)) return null;
  const decoded = decodeLevel(link);
  if (!decoded.ok || levelHash(decoded.level) !== id) return null;
  return { id, title: cleanTitle(title), link, at };
}

function parseSettings(value: unknown): { settings: Settings; corrupt: boolean } {
  const settings = defaultSettings();
  if (value === undefined) return { settings, corrupt: false };
  if (!plain(value)) return { settings, corrupt: true };
  let corrupt = false;
  if (validSize(value.w, value.h)) {
    settings.w = value.w as number;
    settings.h = value.h as number;
  } else if (value.w !== undefined || value.h !== undefined) corrupt = true;
  if (TOOLS.includes(value.tool as ToolName)) settings.tool = value.tool as ToolName;
  else if (value.tool !== undefined) corrupt = true;
  if (typeof value.sprite === "boolean") settings.sprite = value.sprite;
  else if (value.sprite !== undefined) corrupt = true;
  if (typeof value.grid === "boolean") settings.grid = value.grid;
  else if (value.grid !== undefined) corrupt = true;
  return { settings, corrupt };
}

/** Never throws. Broken JSON, another schema or version: empty store, flagged. Bad entries are skipped. */
export function parseStore(raw: string | null): LoadResult {
  if (raw === null) return { store: emptyStore(), corrupt: false };
  if (raw.length > 1_000_000) return { store: emptyStore(), corrupt: true };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { store: emptyStore(), corrupt: true };
  }
  if (!plain(data) || data.schema !== SCHEMA || data.version !== VERSION) return { store: emptyStore(), corrupt: true };
  const store = emptyStore();
  let corrupt = false;
  if (plain(data.best)) {
    for (const [id, value] of Object.entries(data.best).slice(0, BEST_MAX)) {
      const entry = HASH_RE.test(id) ? parseBest(value) : null;
      if (entry) store.best[id] = entry;
      else corrupt = true;
    }
  } else if (data.best !== undefined) corrupt = true;
  if (Array.isArray(data.levels)) {
    for (const value of data.levels.slice(0, LEVELS_MAX)) {
      const saved = parseSaved(value);
      if (saved && !store.levels.some((item) => item.id === saved.id)) store.levels.push(saved);
      else corrupt = true;
    }
  } else if (data.levels !== undefined) corrupt = true;
  const settings = parseSettings(data.settings);
  store.settings = settings.settings;
  if (settings.corrupt) corrupt = true;
  return { store, corrupt };
}

export function serializeStore(store: Store): string {
  return JSON.stringify({ schema: SCHEMA, version: VERSION, best: store.best, levels: store.levels, settings: store.settings });
}

export function loadStore(local: StorageLike | null): LoadResult {
  if (!local) return { store: emptyStore(), corrupt: false };
  try {
    return parseStore(local.getItem(STORE_KEY));
  } catch {
    return { store: emptyStore(), corrupt: false };
  }
}

/** Writes only STORE_KEY. */
export function saveStore(local: StorageLike | null, store: Store): boolean {
  if (!local) return false;
  try {
    local.setItem(STORE_KEY, serializeStore(store));
    return true;
  } catch {
    return false;
  }
}

/** Removes only this tool's key; the sprite, language, theme and other tools stay. */
export function resetStore(local: StorageLike): boolean {
  try {
    local.removeItem(STORE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Keeps the fastest time per level. Oldest entries drop beyond the cap. Returns whether it is a new best. */
export function recordBest(store: Store, id: string, ms: number, coins: number, at: Date): { store: Store; isBest: boolean } {
  const before = store.best[id];
  const isBest = !before || ms < before.ms;
  if (!isBest) return { store, isBest };
  const best = { ...store.best };
  delete best[id];
  best[id] = { ms: Math.round(ms), coins, at: at.toISOString() };
  const ids = Object.keys(best);
  while (ids.length > BEST_MAX) delete best[ids.shift() as string];
  return { store: { ...store, best }, isBest };
}

export type SaveLevelResult = { store: Store; status: "saved" | "updated" | "full" };

/** Saves a level (newest first). Same level again: moved to the top with the new title. Full: refused. */
export function saveLevel(store: Store, level: Level, link: string, at: Date): SaveLevelResult {
  const id = levelHash(level);
  const existing = store.levels.find((item) => item.id === id);
  if (!existing && store.levels.length >= LEVELS_MAX) return { store, status: "full" };
  const entry: SavedLevel = { id, title: cleanTitle(level.title), link, at: at.toISOString() };
  const levels = [entry, ...store.levels.filter((item) => item.id !== id)];
  return { store: { ...store, levels }, status: existing ? "updated" : "saved" };
}

export function deleteLevel(store: Store, id: string): Store {
  return { ...store, levels: store.levels.filter((item) => item.id !== id) };
}
