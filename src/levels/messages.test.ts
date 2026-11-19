import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { copy, fill, formatTime, initialLang, isLang } from "./messages.ts";

function shape(value: unknown, path = ""): string[] {
  if (typeof value === "string") return [`${path}:${[...value.matchAll(/\{([A-Za-z0-9]+)\}/g)].map((m) => m[1]).sort().join(",")}`];
  if (value && typeof value === "object") return Object.keys(value).sort().flatMap((key) => shape((value as Record<string, unknown>)[key], `${path}.${key}`));
  return [`${path}:?`];
}

test("German and English have the same keys and placeholders", () => {
  assert.deepEqual(shape(copy.de), shape(copy.en));
  for (const lang of ["de", "en"] as const) {
    for (const line of shape(copy[lang])) assert.ok(!line.endsWith(":?"), line);
  }
});

test("German is the default language", () => {
  assert.equal(initialLang(null), "de");
  assert.equal(initialLang("fr"), "de");
  assert.equal(initialLang("en"), "en");
  assert.ok(isLang("de"));
  assert.equal(fill("{a} und {b}", { a: 1 }), "1 und {b}");
});

test("the storage note names the own key and the read-only sprite key", () => {
  for (const lang of ["de", "en"] as const) {
    assert.match(copy[lang].storageNote, /consolecheat-levels-v1/);
    assert.match(copy[lang].storageNote, /consolecheat-sprite-v1/);
    for (const key of ["broken", "tooLarge", "version", "size", "tiles", "start", "goal"] as const) assert.ok(copy[lang].linkErrors[key].length > 10, key);
    assert.equal(new Set(Object.values(copy[lang].linkErrors)).size, 7, "every link error has its own message");
  }
  assert.equal(formatTime(65.432), "1:05.43");
  const ui = readFileSync(new URL("./LevelEditor.tsx", import.meta.url), "utf8");
  assert.match(ui, /aria-live="polite"/);
  assert.match(ui, /role="alert"/);
  assert.match(ui, /aria-pressed=\{tool === name\}/);
  assert.match(ui, /aria-label=\{\s*playing/);
});
