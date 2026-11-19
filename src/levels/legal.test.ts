import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { STORE_KEY } from "./storage.ts";

const legal = readFileSync(new URL("./legal.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

test("Datenschutz names the key, local-only storage, and Art. 6 for host logs", () => {
  assert.match(legal, /Art\. 6 Abs\. 1 lit\. f DSGVO/);
  assert.match(legal, /Article 6 \(1\) \(f\) GDPR/);
  assert.match(legal, new RegExp(STORE_KEY));
  assert.match(legal, /Alles bleibt in diesem Browser/);
  assert.match(legal, /Everything stays in this browser/);
  assert.match(legal, /verlassen den Browser nicht/);
  assert.doesNotMatch(legal, /consolecheat-roulette-v1|consolecheat-bingo-v1|Roulette|Bingo|Merkliste/);
  assert.doesNotMatch(legal, / \n/, "a trailing space before a JSX line break is dropped; use {\" \"}");
  assert.match(legal, /never leave the browser/);
  assert.match(legal, /sessionStorage/);
  assert.match(legal, /consolecheat-sprite-v1/);
  assert.match(legal, /Das Sprite wird nur gelesen/);
  assert.match(legal, /sprite is only read/);
  assert.match(legal, /schreibt, ändert oder löscht ihn nie/);
  assert.match(legal, /never writes, changes, or deletes it/);
  assert.match(legal, /keine personenbezogenen Daten/i);
  assert.match(legal, /consolecheat-lang/);
  assert.match(legal, /consolecheat-theme/);
  assert.match(legal, /nur den Schlüssel/);
  assert.match(legal, /Recht auf Auskunft, Berichtigung, Löschung/);
});

test("the Datenschutz reset button removes only the levels key", () => {
  assert.match(app, /resetStore\(local\)/);
  assert.doesNotMatch(app, /localStorage\.clear\(/);
  assert.doesNotMatch(legal, /localStorage\.clear\(/);
  assert.match(legal, /onDeleteAll/);
  assert.match(legal, /role="alertdialog"/);
});

test("the Impressum only has placeholders and invents no operator data", () => {
  assert.match(legal, /\[Name einsetzen\]/);
  assert.match(legal, /\[insert name\]/);
  assert.match(legal, /Platzhalter/);
  assert.doesNotMatch(legal, /@[a-z0-9-]+\.[a-z]{2,}/i, "no email address");
  assert.doesNotMatch(legal, /\+49|\b\d{5}\s+[A-ZÄÖÜ][a-zäöü]+/, "no phone or postal code");
});
