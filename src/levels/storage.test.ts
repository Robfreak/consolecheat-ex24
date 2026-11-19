import assert from "node:assert/strict";
import test from "node:test";
import { emptyLevel } from "./level.ts";
import { sampleLevel, samples } from "./samples.ts";
import { encodeLevel } from "./share.ts";
import {
  BEST_MAX,
  LEVELS_MAX,
  STORE_KEY,
  deleteLevel,
  emptyStore,
  levelHash,
  loadStore,
  parseStore,
  recordBest,
  resetStore,
  saveLevel,
  saveStore,
  serializeStore,
} from "./storage.ts";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

test("round-trips best times, saved levels and settings under its own key only", () => {
  const level = sampleLevel(samples[0], "de");
  let store = emptyStore();
  store = recordBest(store, levelHash(level), 4530, 5, new Date("2026-11-19T10:00:00Z")).store;
  store = saveLevel(store, level, encodeLevel(level), new Date("2026-11-19T10:00:00Z")).store;
  store = { ...store, settings: { w: 40, h: 20, tool: "spike", sprite: false, grid: false } };
  const local = memory({ "consolecheat-sprite-v1": "{}", "consolecheat-theme": "dark", "consolecheat-nonogram-v1": "x" });
  assert.ok(saveStore(local, store));
  assert.deepEqual([...local.data.keys()].sort(), [
    "consolecheat-levels-v1",
    "consolecheat-nonogram-v1",
    "consolecheat-sprite-v1",
    "consolecheat-theme",
  ]);
  assert.equal(local.data.get("consolecheat-sprite-v1"), "{}");
  const back = loadStore(local);
  assert.equal(back.corrupt, false);
  assert.deepEqual(back.store, store);
  const raw = JSON.parse(local.data.get(STORE_KEY) as string);
  assert.equal(raw.schema, "consolecheat-levels");
  assert.equal(raw.version, 1);
});

test("corrupt data falls back without throwing; bad entries are skipped", () => {
  for (const raw of [
    "{",
    "null",
    "[]",
    '"x"',
    JSON.stringify({ schema: "other", version: 1 }),
    JSON.stringify({ schema: "consolecheat-levels", version: 2 }),
  ]) {
    const r = parseStore(raw);
    assert.equal(r.corrupt, true, raw);
    assert.deepEqual(r.store, emptyStore());
  }
  assert.deepEqual(parseStore(null), { store: emptyStore(), corrupt: false });
  const level = emptyLevel();
  const good = { id: levelHash(level), title: "Ok", link: encodeLevel(level), at: "2026-11-19T10:00:00.000Z" };
  const mixed = parseStore(
    JSON.stringify({
      schema: "consolecheat-levels",
      version: 1,
      best: {
        abcdef12: { ms: 1000, coins: 1, at: "2026-11-19T10:00:00Z" },
        nothex: { ms: 1, coins: 0, at: "2026-11-19" },
        "12345678": { ms: -5, coins: 0, at: "x" },
      },
      levels: [good, { ...good, id: "00000000" }, { ...good, link: "lv=9" }, "junk"],
      settings: { w: 999, h: 18, tool: "laser", sprite: "yes", grid: true },
    }),
  );
  assert.equal(mixed.corrupt, true);
  assert.deepEqual(Object.keys(mixed.store.best), ["abcdef12"]);
  assert.deepEqual(mixed.store.levels, [good]);
  assert.deepEqual(mixed.store.settings, { w: 32, h: 18, tool: "solid", sprite: true, grid: true });
  const throwing = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("full");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(loadStore(throwing).store, emptyStore());
  assert.equal(saveStore(throwing, emptyStore()), false);
  assert.equal(resetStore(throwing), false);
  assert.equal(saveStore(null, emptyStore()), false);
});

test("reset removes only consolecheat-levels-v1", () => {
  const local = memory({
    [STORE_KEY]: serializeStore(emptyStore()),
    "consolecheat-sprite-v1": "s",
    "consolecheat-lang": "de",
    "consolecheat-theme": "light",
    "consolecheat-ex6-merkliste-v1": "m",
  });
  assert.ok(resetStore(local));
  assert.deepEqual([...local.data.keys()].sort(), [
    "consolecheat-ex6-merkliste-v1",
    "consolecheat-lang",
    "consolecheat-sprite-v1",
    "consolecheat-theme",
  ]);
});

test("best times keep the fastest and cap at 200; saved levels cap at 50", () => {
  let store = emptyStore();
  store = recordBest(store, "aaaaaaaa", 5000, 1, new Date()).store;
  const slower = recordBest(store, "aaaaaaaa", 6000, 3, new Date());
  assert.equal(slower.isBest, false);
  assert.equal(slower.store.best.aaaaaaaa.ms, 5000);
  const faster = recordBest(store, "aaaaaaaa", 4000, 0, new Date());
  assert.equal(faster.isBest, true);
  assert.equal(faster.store.best.aaaaaaaa.ms, 4000);
  for (let i = 0; i < BEST_MAX + 10; i++) store = recordBest(store, i.toString(16).padStart(8, "0"), 1000 + i, 0, new Date()).store;
  assert.equal(Object.keys(store.best).length, BEST_MAX);
  assert.equal(store.best.aaaaaaaa, undefined, "oldest dropped first");

  let saved = emptyStore();
  for (let i = 0; i < LEVELS_MAX; i++) {
    const level = emptyLevel(16 + (i % 40), 9 + Math.floor(i / 40), `L${i}`);
    const r = saveLevel(saved, level, encodeLevel(level), new Date());
    assert.equal(r.status, "saved");
    saved = r.store;
  }
  const extra = emptyLevel(60, 30);
  assert.equal(saveLevel(saved, extra, encodeLevel(extra), new Date()).status, "full");
  const again = emptyLevel(16, 9, "Renamed");
  const updated = saveLevel(saved, again, encodeLevel(again), new Date());
  assert.equal(updated.status, "updated");
  assert.equal(updated.store.levels[0].title, "Renamed");
  assert.equal(updated.store.levels.length, LEVELS_MAX);
  assert.equal(deleteLevel(updated.store, updated.store.levels[0].id).levels.length, LEVELS_MAX - 1);
});

test("the level hash is stable and depends only on size and tiles", () => {
  const a = sampleLevel(samples[0], "de");
  const b = sampleLevel(samples[0], "en");
  assert.equal(levelHash(a), levelHash(b));
  assert.match(levelHash(a), /^[0-9a-f]{8}$/);
  assert.notEqual(levelHash(a), levelHash(sampleLevel(samples[1], "de")));
});
