// Static reachability check: can the goal be reached from the start?
//
// The check does not use a separate jump formula. It runs the real `step` physics
// from every place the player can stand, with a fixed menu of input patterns:
// walk one tile left or right, walk off a ledge (holding or releasing the
// direction), run off a ledge and jump inside the coyote time, and jumps with
// full or short height, the direction pressed from the start or after a delay,
// released early or not, from standing or with a run-up. Every landing spot
// becomes a new place to stand (breadth-first). Spikes and pits end a try. A try
// that touches a goal tile means "reachable".
//
// With the physics constants this clears walls up to 3 tiles high and gaps up to
// 4 tiles wide (max jump height v²/2g = 53.3 px, flight 2v/g · run speed = 56 px).
//
// It is conservative: it only reports "reachable" for paths it actually played
// (each try starts centred on a tile, so a real player has the same room or
// more). Tricks outside the input menu (pixel-exact wall clips, mid-air direction
// changes beyond the menu) are not tried, so a very hard but possible level can
// be flagged as unreachable. The editor shows this as a warning only; the level
// can still be edited, played and shared.

import { findStart, type Level } from "./level.ts";
import { PLAYER_H, PLAYER_W, RUN_SPEED, TILE, spawnBody, step, type Body, type TickInput } from "./physics.ts";

/** `complete` is false when the step budget ran out before the search finished. */
export type ReachResult = { reachable: boolean; complete: boolean; spots: number; steps: number };

const MAX_TRY_TICKS = 300;
const MAX_STEPS = 6_000_000;

type Spot = { x: number; y: number };

type Pattern = {
  dir: -1 | 0 | 1;
  jumpTicks: number;
  dirFrom: number;
  dirUntil: number;
  runUp: boolean;
  walkOff: "hold" | "release" | "jump" | null;
  coyote: number;
};

function patterns(): Pattern[] {
  const list: Pattern[] = [];
  for (const dir of [-1, 1] as const) {
    list.push({ dir, jumpTicks: 0, dirFrom: 0, dirUntil: Infinity, runUp: false, walkOff: "hold", coyote: 0 });
    list.push({ dir, jumpTicks: 0, dirFrom: 0, dirUntil: Infinity, runUp: false, walkOff: "release", coyote: 0 });
    // Run off the ledge and jump inside the coyote time (0, 5 or 10 steps after leaving the ground).
    for (const coyote of [0, 5, 10]) list.push({ dir, jumpTicks: Infinity, dirFrom: 0, dirUntil: Infinity, runUp: true, walkOff: "jump", coyote });
    for (const jumpTicks of [Infinity, 24, 10]) {
      for (const runUp of [false, true]) {
        for (const dirFrom of [0, 12, 24, 36]) list.push({ dir, jumpTicks, dirFrom, dirUntil: Infinity, runUp, walkOff: null, coyote: 0 });
        for (const dirUntil of [8, 16, 28, 44]) list.push({ dir, jumpTicks, dirFrom: 0, dirUntil, runUp, walkOff: null, coyote: 0 });
      }
    }
  }
  for (const jumpTicks of [Infinity, 24, 10])
    list.push({ dir: 0, jumpTicks, dirFrom: 0, dirUntil: Infinity, runUp: false, walkOff: null, coyote: 0 });
  return list;
}

const PATTERNS = patterns();

function tileOf(body: Body): { col: number; row: number } {
  return { col: Math.floor((body.x + PLAYER_W / 2) / TILE), row: Math.floor((body.y + PLAYER_H - 1) / TILE) };
}

function bodyAt(spot: Spot, vx = 0): Body {
  return { x: spot.x, y: spot.y, vx, vy: 0, onGround: true, coyote: 0, buffer: 0, canCut: false, facing: 1, jumps: 0 };
}

export function analyzeReach(level: Level): ReachResult {
  let steps = 0;
  if (!findStart(level)) return { reachable: false, complete: true, spots: 0, steps };
  const seen = new Set<string>();
  const queue: Spot[] = [];

  function addSpot(body: Body) {
    const { col, row } = tileOf(body);
    const key = `${col},${row}`;
    if (seen.has(key)) return;
    seen.add(key);
    // Stand centred on the tile if the floor below the centre carries the player, else keep the landed x.
    const cx = col * TILE + (TILE - PLAYER_W) / 2;
    const below = row + 1 < level.h ? level.tiles[(row + 1) * level.w + col] : -1;
    queue.push({ x: below === 1 ? cx : body.x, y: body.y });
  }

  // Fall from the start until standing.
  const spawn = spawnBody(level);
  for (let t = 0; t < MAX_TRY_TICKS; t++) {
    steps++;
    const result = step(spawn, { dir: 0, jumpHeld: false, jumpPressed: false }, level);
    if (result === "goal") return { reachable: true, complete: true, spots: 0, steps };
    if (result === "dead") return { reachable: false, complete: true, spots: 0, steps };
    if (spawn.onGround) break;
  }
  if (!spawn.onGround) return { reachable: false, complete: true, spots: 0, steps };
  addSpot(spawn);

  while (queue.length) {
    const spot = queue.shift() as Spot;
    for (const p of PATTERNS) {
      if (steps > MAX_STEPS) return { reachable: false, complete: false, spots: seen.size, steps };
      const body = bodyAt(spot, p.runUp ? p.dir * RUN_SPEED : 0);
      if (p.runUp) {
        // A run-up needs room behind: the same row one tile back must be free and carried.
        const { col, row } = tileOf(body);
        const back = col - p.dir;
        if (back < 0 || back >= level.w) continue;
        const behind = level.tiles[row * level.w + back];
        const floor = row + 1 < level.h ? level.tiles[(row + 1) * level.w + back] : -1;
        if (behind === 1 || behind === 2 || floor !== 1) continue;
      }
      const startTile = tileOf(body);
      let left = false;
      let leftAt = -1;
      for (let t = 0; t < MAX_TRY_TICKS; t++) {
        let input: TickInput;
        if (p.walkOff === "jump") {
          input = { dir: p.dir, jumpHeld: leftAt >= 0, jumpPressed: leftAt >= 0 && t === leftAt + p.coyote };
        } else if (p.walkOff) {
          const dir = p.walkOff === "release" && left ? 0 : p.dir;
          input = { dir, jumpHeld: false, jumpPressed: false };
        } else {
          const dir = t >= p.dirFrom && t < p.dirUntil ? p.dir : 0;
          input = { dir, jumpHeld: t < p.jumpTicks, jumpPressed: t === 0 };
        }
        steps++;
        const result = step(body, input, level);
        if (result === "goal") return { reachable: true, complete: true, spots: seen.size, steps };
        if (result === "dead") break;
        if (!body.onGround && !left) {
          left = true;
          leftAt = t + 1;
        }
        if (p.walkOff === "jump") {
          if (leftAt < 0 && t > 60) break; // never left the ground
          if (leftAt >= 0 && t > leftAt + p.coyote && body.onGround) {
            addSpot(body);
            break;
          }
        } else if (p.walkOff) {
          const now = tileOf(body);
          if (body.onGround && (now.col !== startTile.col || now.row !== startTile.row)) {
            addSpot(body);
            break;
          }
          if (body.onGround && t > 40 && Math.abs(body.vx) < 1) break; // walked into a wall
        } else if (left && body.onGround) {
          addSpot(body);
          break;
        }
      }
    }
  }
  return { reachable: false, complete: true, spots: seen.size, steps };
}
