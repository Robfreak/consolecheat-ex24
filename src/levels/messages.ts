export const languageOptions = [
  { id: "de", label: "Deutsch" },
  { id: "en", label: "English" },
] as const;

export type Lang = (typeof languageOptions)[number]["id"];

const de = {
  brand: "consolecheat",
  title: "Mini-Level-Editor mit Plattformer",
  metaDescription:
    "Mini-Level-Editor: Level aus Blöcken, Stacheln, Münzen und Ziel bauen und sofort mit Gamepad, Tastatur oder Touch spielen. Teilen per Link, Bestzeiten lokal. Inoffiziell, nicht von Sony.",
  eyebrow: "Werkzeug · Spiel",
  lede: "Bau ein Level im Raster und spiel es sofort: laufen, springen, Münzen sammeln, Stacheln ausweichen und ins Ziel. Teile dein Level per Link und jage deine Bestzeit.",
  freeClaim: "Komplett kostenlos. Auf dieser Seite kostet nichts Geld.",
  privacyClaim: "Keine sensiblen Daten werden gespeichert. Level, Bestzeiten und Einstellungen bleiben in diesem Browser.",
  unofficial: "Inoffiziell. Nicht von Sony.",
  footerNote: "Level entstehen und laufen auf diesem Gerät. Diese Seite ist nicht Sony.",
  themeDark: "Dunkles Erscheinungsbild",
  themeLight: "Helles Erscheinungsbild",
  language: "Sprache",
  footerNav: "Seitenfuß",
  toolsHeading: "Weitere Werkzeuge",
  merkliste: "Zur Merkliste",
  storageNote:
    "Bestzeiten, gespeicherte Level und Editor-Einstellungen liegen im localStorage unter consolecheat-levels-v1. Das Sprite aus dem Sprite-Animator (consolecheat-sprite-v1) wird nur gelesen.",
  controlsHeading: "Steuerung",
  controls:
    "Spielen: Pfeiltasten oder A/D laufen, Leertaste, W oder Pfeil hoch springen (länger halten springt höher), R neu starten, Enter wechselt zum Editor. Controller: Steuerkreuz oder linker Stick laufen, × springt, ○ startet neu, Options wechselt. Editor: Klicken oder Ziehen malt, Rechtsklick radiert; Pfeiltasten bewegen den Cursor, Leertaste malt, Rücktaste radiert, Q/E oder 1–6 wählen das Werkzeug, Strg+Z/Strg+Y machen rückgängig und wiederholen. Controller im Editor: Steuerkreuz bewegt, × malt, ○ radiert, L1/R1 Werkzeug, L2/R2 rückgängig/wiederholen. In Textfeldern, Auswahllisten und Schiebereglern greifen keine Kürzel.",
  modeEdit: "Editor",
  modePlay: "Spielen",
  modeGroup: "Modus",
  toolsLegend: "Werkzeug",
  tools: { empty: "Leer", solid: "Block", spike: "Stacheln", coin: "Münze", start: "Start", goal: "Ziel" },
  toolHint: "Werkzeug {n}",
  undo: "Rückgängig",
  redo: "Wiederholen",
  fillRow: "Zeile füllen",
  clearLevel: "Leeren",
  gridToggle: "Raster zeigen",
  spriteToggle: "Sprite als Spielfigur",
  spriteOk: "Sprite aus dem Sprite-Animator ({size}×{size}, {frames} Bild(er), nur gelesen).",
  spriteMissing: "Kein Sprite gefunden. Es spielt die Standardfigur.",
  spriteCorrupt: "Das Sprite ist nicht lesbar. Es spielt die Standardfigur.",
  spriteBlocked: "Der Browser-Speicher ist gesperrt. Es spielt die Standardfigur.",
  sizeLegend: "Größe",
  widthLabel: "Breite (16–64)",
  heightLabel: "Höhe (9–32)",
  applySize: "Größe übernehmen",
  titleLabel: "Titel",
  canvasLabel: "Level {title}, {w} mal {h} Felder. Cursor Spalte {x}, Zeile {y}: {tile}",
  canvasPlayLabel: "Spiel {title}",
  untitled: "Ohne Titel",
  samplesHeading: "Beispiel-Level",
  savedHeading: "Eigene Level",
  savedEmpty: "Noch keine Level gespeichert.",
  save: "Speichern",
  saved: "Gespeichert.",
  savedUpdated: "Gespeichert (aktualisiert).",
  savedFull: "Es passen höchstens 50 Level in die Liste. Lösch zuerst eins.",
  load: "Laden",
  remove: "Löschen",
  bestLabel: "Bestzeit {time}",
  share: "Link teilen",
  shareCopied: "Link kopiert.",
  shareManual: "Kopieren ging nicht automatisch. Markiere den Link und kopiere ihn selbst.",
  shareLabel: "Link zu diesem Level",
  problems: {
    start: "Das Level braucht genau einen Start.",
    goal: "Das Level braucht mindestens ein Ziel.",
  },
  reachChecking: "Prüfe, ob das Ziel erreichbar ist …",
  reachOk: "Ziel erreichbar.",
  reachBad: "Achtung: Laut Prüfung ist das Ziel von Start aus nicht erreichbar (zu breite Lücke, zu hohe Wand oder nur durch Stacheln). Du kannst trotzdem weiterbauen.",
  reachUnknown: "Die Prüfung war für dieses große Level zu aufwendig und wurde abgebrochen. Ob das Ziel erreichbar ist, ist offen.",
  reachPlayNotice: "Hinweis: Dieses Level ist laut Prüfung wahrscheinlich nicht schaffbar.",
  reachShareNotice: "Hinweis: Laut Prüfung ist das Ziel in diesem Level nicht erreichbar.",
  reachInfo: "Die Prüfung spielt Laufen und Sprünge mit der echten Physik durch: Sprunghöhe bis 3 Felder, Lücken bis 4 Felder. Sie ist vorsichtig und kann sehr knifflige, aber machbare Level als unerreichbar melden.",
  hudTime: "Zeit",
  hudCoins: "Münzen",
  hudDeaths: "Fehlversuche",
  retry: "Neu starten",
  backToEditor: "Zurück zum Editor",
  finished: "Ziel erreicht in {time}! Münzen {coins} von {total}, Fehlversuche {deaths}.",
  finishedBest: "Neue Bestzeit!",
  died: "Autsch! Zurück zum Start.",
  coin: "Münze {coins} von {total}.",
  playBlocked: "Spielen geht erst, wenn das Level genau einen Start und mindestens ein Ziel hat.",
  touchLeft: "Links",
  touchRight: "Rechts",
  touchJump: "Springen",
  linkOpened: "Level aus dem Link geöffnet.",
  linkErrors: {
    broken: "Der Link ist beschädigt oder unvollständig. Das Level konnte nicht gelesen werden.",
    tooLarge: "Der Link ist zu lang (über 8 KB) und wird nicht geöffnet.",
    version: "Der Link stammt aus einer anderen Version des Editors und wird nicht geöffnet.",
    size: "Die Größe im Link ist ungültig (Breite 16–64, Höhe 9–32).",
    tiles: "Der Link enthält unbekannte Felder.",
    start: "Das Level im Link hat nicht genau einen Start.",
    goal: "Das Level im Link hat kein Ziel.",
  },
  storeCorrupt: "Ein Teil der gespeicherten Daten war unlesbar und wurde übersprungen.",
  saveFailed: "Speichern ging nicht. Der Speicher des Browsers ist voll oder gesperrt.",
  deleteAll: "Level-Daten löschen",
  deleteAsk:
    "Wirklich die Level-Daten in diesem Browser löschen? Nur der Schlüssel consolecheat-levels-v1 (Bestzeiten, eigene Level, Einstellungen). Sprite, Sprache und Erscheinungsbild bleiben.",
  deleteYes: "Nur die Level-Daten löschen",
  deleteNo: "Abbrechen",
  deleted: "Die Level-Daten sind aus diesem Browser gelöscht.",
  deleteFailed: "Die Level-Daten konnten nicht gelöscht werden.",
};

export type Copy = typeof de;

const en: Copy = {
  brand: "consolecheat",
  title: "Mini level editor with platformer",
  metaDescription:
    "Mini level editor: build a level from blocks, spikes, coins and a goal and play it right away with a gamepad, keyboard or touch. Share by link, best times stay local. Unofficial, not from Sony.",
  eyebrow: "Tool · Game",
  lede: "Build a level on a grid and play it right away: run, jump, collect coins, dodge spikes and reach the goal. Share your level by link and chase your best time.",
  freeClaim: "Completely free. This page does not charge anything.",
  privacyClaim: "No sensitive data is stored. Levels, best times and settings stay in this browser.",
  unofficial: "Unofficial. Not from Sony.",
  footerNote: "Levels are made and played on this device. This page is not Sony.",
  themeDark: "Dark appearance",
  themeLight: "Light appearance",
  language: "Language",
  footerNav: "Footer",
  toolsHeading: "Other tools",
  merkliste: "Back to the backlog",
  storageNote:
    "Best times, saved levels and editor settings use the localStorage key consolecheat-levels-v1. The sprite from the Sprite animator (consolecheat-sprite-v1) is only read.",
  controlsHeading: "Controls",
  controls:
    "Play: arrow keys or A/D run, Space, W or Up jump (hold longer to jump higher), R restarts, Enter switches to the editor. Controller: D-pad or left stick run, × jumps, ○ restarts, Options switches. Editor: click or drag paints, right click erases; arrow keys move the cursor, Space paints, Backspace erases, Q/E or 1–6 pick the tool, Ctrl+Z/Ctrl+Y undo and redo. Controller in the editor: D-pad moves, × paints, ○ erases, L1/R1 tool, L2/R2 undo/redo. Text fields, selects and sliders keep their keys.",
  modeEdit: "Editor",
  modePlay: "Play",
  modeGroup: "Mode",
  toolsLegend: "Tool",
  tools: { empty: "Empty", solid: "Block", spike: "Spikes", coin: "Coin", start: "Start", goal: "Goal" },
  toolHint: "Tool {n}",
  undo: "Undo",
  redo: "Redo",
  fillRow: "Fill row",
  clearLevel: "Clear",
  gridToggle: "Show grid",
  spriteToggle: "Sprite as player",
  spriteOk: "Sprite from the Sprite animator ({size}×{size}, {frames} frame(s), read only).",
  spriteMissing: "No sprite found. The default character plays.",
  spriteCorrupt: "The sprite can't be read. The default character plays.",
  spriteBlocked: "Browser storage is blocked. The default character plays.",
  sizeLegend: "Size",
  widthLabel: "Width (16–64)",
  heightLabel: "Height (9–32)",
  applySize: "Apply size",
  titleLabel: "Title",
  canvasLabel: "Level {title}, {w} by {h} tiles. Cursor column {x}, row {y}: {tile}",
  canvasPlayLabel: "Game {title}",
  untitled: "Untitled",
  samplesHeading: "Sample levels",
  savedHeading: "Your levels",
  savedEmpty: "No levels saved yet.",
  save: "Save",
  saved: "Saved.",
  savedUpdated: "Saved (updated).",
  savedFull: "The list holds at most 50 levels. Delete one first.",
  load: "Load",
  remove: "Delete",
  bestLabel: "Best {time}",
  share: "Share link",
  shareCopied: "Link copied.",
  shareManual: "Copying didn't work automatically. Select the link and copy it yourself.",
  shareLabel: "Link to this level",
  problems: {
    start: "The level needs exactly one start.",
    goal: "The level needs at least one goal.",
  },
  reachChecking: "Checking whether the goal can be reached …",
  reachOk: "Goal reachable.",
  reachBad: "Heads up: the check says the goal can't be reached from the start (gap too wide, wall too high or only through spikes). You can keep building.",
  reachUnknown: "The check was too costly for this large level and stopped. Whether the goal can be reached is open.",
  reachPlayNotice: "Note: the check says this level is probably not beatable.",
  reachShareNotice: "Note: the check says the goal in this level can't be reached.",
  reachInfo: "The check plays runs and jumps with the real physics: jumps up to 3 tiles high, gaps up to 4 tiles. It is cautious and may flag very tricky but possible levels as unreachable.",
  hudTime: "Time",
  hudCoins: "Coins",
  hudDeaths: "Deaths",
  retry: "Restart",
  backToEditor: "Back to the editor",
  finished: "Goal reached in {time}! Coins {coins} of {total}, deaths {deaths}.",
  finishedBest: "New best time!",
  died: "Ouch! Back to the start.",
  coin: "Coin {coins} of {total}.",
  playBlocked: "You can play once the level has exactly one start and at least one goal.",
  touchLeft: "Left",
  touchRight: "Right",
  touchJump: "Jump",
  linkOpened: "Level opened from the link.",
  linkErrors: {
    broken: "The link is damaged or incomplete. The level could not be read.",
    tooLarge: "The link is too long (over 8 KB) and is not opened.",
    version: "The link comes from another version of the editor and is not opened.",
    size: "The size in the link is invalid (width 16–64, height 9–32).",
    tiles: "The link contains unknown tiles.",
    start: "The level in the link does not have exactly one start.",
    goal: "The level in the link has no goal.",
  },
  storeCorrupt: "Part of the saved data could not be read and was skipped.",
  saveFailed: "Saving failed. Browser storage is full or blocked.",
  deleteAll: "Delete level data",
  deleteAsk:
    "Really delete the level data in this browser? Only the key consolecheat-levels-v1 (best times, your levels, settings). Sprite, language and appearance stay.",
  deleteYes: "Delete only the level data",
  deleteNo: "Cancel",
  deleted: "The level data has been deleted from this browser.",
  deleteFailed: "The level data could not be deleted.",
};

export const copy: Record<Lang, Copy> = { de, en };

const ids = new Set<string>(languageOptions.map((item) => item.id));

export function isLang(value: string | null): value is Lang {
  return value !== null && ids.has(value);
}

export function initialLang(stored: string | null): Lang {
  return isLang(stored) ? stored : "de";
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([A-Za-z0-9]+)\}/g, (all, key: string) => {
    const value = values[key];
    return value === undefined ? all : String(value);
  });
}

/** m:ss.cc */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 100));
  const cs = total % 100;
  const s = Math.floor(total / 100) % 60;
  const m = Math.floor(total / 6000);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
