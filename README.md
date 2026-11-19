# Mini-Level-Editor mit Plattformer · consolecheat-ex24

Bau ein Level im Raster aus Blöcken, Stacheln, Münzen, Start und Ziel und spiel es sofort mit Gamepad, Tastatur oder Touch. Levels lassen sich per Link teilen, die Bestzeit pro Level bleibt lokal, und ein Sprite aus dem Sprite-Animator kann die Spielfigur sein. Teil der consolecheat-Werkzeuge. Inoffiziell, nicht von Sony.

**Live:** https://robfreak.github.io/consolecheat-ex24/ (nachdem GitHub Pages eingeschaltet ist, siehe unten)

## Editor

- Raster 32×18 (Standard), frei 16–64 breit und 9–32 hoch. Beim Ändern der Größe bleibt die linke untere Ecke stehen, damit der Boden der Boden bleibt.
- Werkzeuge: Leer, Block, Stacheln, Münze, Start (genau einer, ein neuer Start ersetzt den alten), Ziel (mindestens eins). Klicken oder Ziehen malt (auch per Touch), Rechtsklick radiert. „Zeile füllen“ füllt die Cursor-Zeile mit dem Werkzeug.
- Rückgängig/Wiederholen (Strg+Z / Strg+Y, bis 100 Schritte; ein Zug mit der Maus ist ein Schritt).
- 3 Beispiel-Level (Erste Schritte, Stachelgarten, Turmaufstieg), alle per Test als erreichbar geprüft; „Erste Schritte“ wird in den Tests per Skript bis ins Ziel gespielt.
- Eigene Level speichern (höchstens 50), laden, löschen.
- Fehlt der Start oder das Ziel, steht das unter dem Spielfeld; Spielen, Teilen und Speichern gehen dann nicht.

## Spielen

Laufen, Springen mit variabler Höhe (Taste früh loslassen = kürzerer Sprung), Coyote-Time und Sprungpuffer, feste Kollision mit Blöcken. Stacheln und Abgründe schicken zurück zum Start (Fehlversuch, Zeit läuft weiter, Münzen bleiben). Münzen werden gezählt. Wer ein Ziel berührt, ist fertig; Zeit, Münzen und Fehlversuche kommen per `aria-live`, die Bestzeit wird gespeichert. „Neu starten“ setzt Zeit, Münzen und Fehlversuche zurück. Enter / Options wechselt jederzeit zwischen Editor und Spiel.

### Physik mit festem Zeitschritt

Die Physik läuft immer in Schritten von **1/120 s** (`src/levels/physics.ts`). Ein Akkumulator (`FixedStepper`) verteilt die echte Bildzeit auf ganze Schritte, ein einzelnes Bild zählt höchstens 0,25 s; gezeichnet wird zwischen dem vorigen und dem aktuellen Schritt interpoliert. Eingaben gelten für das ganze Bild, ein Sprung-Druck wird bis zum nächsten Schritt gehalten. Ein Test spielt dieselben Eingaben bei 30, 60 und 144 Bildern pro Sekunde und erwartet identische Positionen, Zeit, Münzen und Ausgang.

Konstanten (1 Feld = 16 px):

| Wert | |
| --- | --- |
| Hitbox | 12 × 14 px (bleibt auch mit Sprite gleich) |
| Laufen | 105 px/s, Beschleunigung 1000 px/s² am Boden, 700 px/s² in der Luft |
| Schwerkraft | 1500 px/s², Fallgeschwindigkeit höchstens 480 px/s |
| Absprung | 400 px/s; Loslassen beim Steigen behält 45 % der Geschwindigkeit |
| Coyote-Time | 12 Schritte (100 ms) |
| Sprungpuffer | 14 Schritte (≈117 ms) |
| Max. Sprunghöhe | v²/2g = 53,3 px ≈ 3,3 Felder |
| Max. Sprungweite | 2v/g · 105 px/s = 56 px ≈ 3,5 Felder Flug auf gleicher Höhe |

## Erreichbarkeit

`src/levels/reach.ts` prüft statisch, ob ein Ziel vom Start aus erreichbar ist. Es gibt keine eigene Sprungformel: Von jedem Platz, auf dem die Figur stehen kann, spielt die Prüfung mit der echten `step`-Physik ein festes Menü an Eingaben durch (ein Feld laufen, von einer Kante laufen mit oder ohne Richtung, Absprung innerhalb der Coyote-Time, Sprünge mit voller oder kurzer Höhe, Richtung sofort oder verzögert, früh losgelassen, mit oder ohne Anlauf). Jeder Landeplatz wird ein neuer Startplatz (Breitensuche). Stacheln und Abgründe beenden einen Versuch.

Die Prüfung ist **vorsichtig**: Sie meldet „erreichbar“ nur für Wege, die sie wirklich gespielt hat. Mit den Konstanten oben schafft sie Wände bis **3 Felder** Höhe und Lücken bis **4 Felder** Breite (per Test: 4 Felder hoch und 5 Felder breit gelten als unerreichbar). Sehr knifflige, aber mögliche Wege außerhalb des Menüs können als unerreichbar gemeldet werden. Unerreichbare Level lassen sich trotzdem bearbeiten, spielen und teilen; Editor, geöffneter Link, Spielen und Teilen zeigen dann einen deutlichen Hinweis. Bei sehr großen Leveln bricht die Prüfung nach 6 Mio. Schritten ab und meldet „offen“.

## Teilen per Link

```
#lv=1&w=32&h=18&d=<Felder>&t=<Titel>
```

- `lv`: Version 1. `w`/`h`: 16–64 / 9–32.
- `d`: Lauflängen als Bytes, base64url ohne Padding. Je Lauf ein Byte: obere 3 Bit Feldcode (0 leer, 1 Block, 2 Stacheln, 3 Münze, 4 Start, 5 Ziel), untere 5 Bit Länge − 1 (1–32). Zeilenweise von links oben, zusammen genau w × h Felder.
- `t`: optionaler Titel (URL-kodiert, höchstens 40 Zeichen, Steuerzeichen und `<>` werden entfernt).
- Der Hash darf höchstens **8 KB** (8192 Zeichen) lang sein.

Beim Öffnen wird alles geprüft und nie abgestürzt. Eigene Meldungen gibt es für: beschädigt/unvollständig (fehlende Teile, kaputtes base64url, Läufe passen nicht zur Größe, doppelte Parameter), zu lang, andere Version, ungültige Größe, unbekannte Feldcodes, nicht genau ein Start, kein Ziel. Der Teil hinter `#` geht nicht an den Server.

## Sprite als Spielfigur: nur lesen

Alle consolecheat-Werkzeuge liegen auf `robfreak.github.io` und teilen sich den `localStorage`. Der Editor liest `consolecheat-sprite-v1` aus dem Sprite-Animator (`Robfreak/consolecheat-ex14`) nur mit `getItem` und schreibt, ändert oder löscht ihn **nie**:

`{ "version": 1, "size": 16|32|64, "frames": ["<Lauflängen>", …], "index": n, "fps": 8, … }` mit Lauflängen `ANZAHL:0` (transparent) oder `ANZAHL:RRGGBBAA`, durch Kommas getrennt, zusammen genau size × size Pixel; 1–64 Bilder.

Beim Laufen werden die Bilder mit dem `fps` des Sprites (1–24, sonst 8) abgespielt, im Stand Bild 0, nach links gespiegelt. Fehlt das Sprite oder ist es kaputt, spielt die Standardfigur. Die Hitbox bleibt 12 × 14 px.

## Steuerung

| Tastatur | Controller | Aktion |
| --- | --- | --- |
| Pfeil links/rechts, A/D | Steuerkreuz, linker Stick | Laufen |
| Leertaste, W, Pfeil hoch | × | Springen (halten = höher) |
| R | ○ | Neu starten |
| Enter (Esc im Spiel) | Options | Editor ↔ Spielen |
| Pfeiltasten | Steuerkreuz, linker Stick | Editor: Cursor bewegen |
| Leertaste | × | Editor: malen |
| Rücktaste, Entf | ○ | Editor: radieren |
| Q / E, 1–6 | L1 / R1 | Editor: Werkzeug |
| Strg+Z / Strg+Y | L2 / R2 | Editor: rückgängig / wiederholen |

Auf Touch-Geräten erscheinen im Spiel Knöpfe für links, rechts und springen.

**Erster Abruf:** Der erste Abruf eines Controllers, auch nach dem Wiederverbinden, nach einem anderen Pad im selben Slot oder während ein Eingabefeld den Fokus hat, merkt sich nur den Tastenzustand. Eine Taste, die dabei schon gedrückt war, zählt erst, nachdem sie einmal losgelassen wurde. Wer beim Laden × hält, springt also nicht. Tastatur-Wiederholungen lösen keine Aktion aus. In Textfeldern, Zahlenfeldern, Auswahllisten und Schiebereglern greifen keine Kürzel; auf Knöpfen bleiben Leertaste und Enter beim Knopf.

## Speicher

`consolecheat-levels-v1` (Schema `consolecheat-levels`, Version 1):

```json
{
  "schema": "consolecheat-levels", "version": 1,
  "best": { "<Level-Hash>": { "ms": 12345, "coins": 3, "at": "<ISO-Datum>" } },
  "levels": [ { "id": "<Level-Hash>", "title": "…", "link": "lv=1&w=…", "at": "<ISO-Datum>" } ],
  "settings": { "w": 32, "h": 18, "tool": "solid", "sprite": true, "grid": true }
}
```

Der Level-Hash ist FNV-1a (32 Bit, hex) über `w,h,<Felder>`, also gleich für Beispiel, gespeichertes Level und Link. Höchstens 200 Bestzeiten und 50 Level; jedes gespeicherte Level wird beim Laden wie ein Link geprüft. Unlesbare Teile werden übersprungen, eine andere Version fällt auf leere Daten zurück. Der Knopf auf der Datenschutz-Seite löscht nur diesen Schlüssel; das Sprite wird nur gelesen.

## Entwicklung

Node 22.6 oder neuer.

```sh
npm ci
npm test        # node --test über src/levels/*.test.ts
npm run build   # tsc, vite build, scripts/check-dist.mjs
npm run dev
```

Der Code liegt in `src/levels`. Die Seite lädt nichts von Dritten; `scripts/check-dist.mjs` prüft das im Build.

## GitHub Pages einschalten

Der Workflow `.github/workflows/pages.yml` baut bei jedem Push auf `main` und legt `dist/` in den Branch `gh-pages`. Einmalig: **Settings → Pages → Source: Deploy from a branch → Branch `gh-pages` / `(root)`**. Danach ist die Seite unter https://robfreak.github.io/consolecheat-ex24/ erreichbar.

## Lizenz der Schriften

Outfit und Source Sans 3 stehen unter der SIL Open Font License, siehe `public/FONT-OFL.txt` und `THIRD_PARTY_NOTICES.md`.
