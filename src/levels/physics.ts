// Platformer physics on a fixed timestep. All values in pixels, one tile is 16 px.
// Nothing here reads the frame time: one call to `step` is always 1/120 s, so the
// outcome only depends on the sequence of inputs per tick, never on the render rate.

import { TILE_COIN, TILE_GOAL, TILE_SOLID, TILE_SPIKE, findStart, type Level } from "./level.ts";

export const TILE = 16;
export const HZ = 120;
export const DT = 1 / HZ;
/** A frame longer than this (tab in the background, debugger) is clamped. */
export const MAX_FRAME = 0.25;

export const PLAYER_W = 12;
export const PLAYER_H = 14;
export const RUN_SPEED = 105; // px/s
export const GROUND_ACCEL = 1000; // px/s²
export const AIR_ACCEL = 700;
export const GROUND_FRICTION = 1400;
export const AIR_FRICTION = 350;
export const GRAVITY = 1500; // px/s²
export const JUMP_SPEED = 400; // px/s upwards
export const MAX_FALL = 480;
/** Releasing jump while rising keeps this share of the upward speed (variable height). */
export const JUMP_CUT = 0.45;
export const COYOTE_TICKS = 12; // 100 ms after leaving a ledge
export const BUFFER_TICKS = 14; // ~117 ms before landing

/** Highest jump in px (feet), from the constants: v² / 2g. */
export const MAX_JUMP_HEIGHT = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY);
/** Time in the air for a full jump back to the same height, and the distance at full run speed. */
export const AIR_TIME = (2 * JUMP_SPEED) / GRAVITY;
export const MAX_JUMP_DISTANCE = AIR_TIME * RUN_SPEED;

export type TickInput = { dir: -1 | 0 | 1; jumpHeld: boolean; jumpPressed: boolean };
export const NO_INPUT: TickInput = { dir: 0, jumpHeld: false, jumpPressed: false };

export type Body = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  coyote: number;
  buffer: number;
  canCut: boolean;
  facing: -1 | 1;
  /** Jumps started so far (for the HUD and tests). */
  jumps: number;
};

export type StepEvent = "dead" | "goal" | null;

export function spawnBody(level: Level): Body {
  const start = findStart(level) ?? { x: 0, y: 0 };
  return {
    x: start.x * TILE + (TILE - PLAYER_W) / 2,
    y: start.y * TILE + (TILE - PLAYER_H),
    vx: 0,
    vy: 0,
    onGround: false,
    coyote: 0,
    buffer: 0,
    canCut: false,
    facing: 1,
    jumps: 0,
  };
}

function solidAt(level: Level, col: number, row: number): boolean {
  if (col < 0 || col >= level.w) return true; // side walls
  if (row < 0) return true; // ceiling
  if (row >= level.h) return false; // open pit below
  return level.tiles[row * level.w + col] === TILE_SOLID;
}

function overlapsSolid(level: Level, x: number, y: number): { col: number; row: number } | null {
  const c0 = Math.floor(x / TILE);
  const c1 = Math.floor((x + PLAYER_W - 1e-6) / TILE);
  const r0 = Math.floor(y / TILE);
  const r1 = Math.floor((y + PLAYER_H - 1e-6) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solidAt(level, c, r)) return { col: c, row: r };
  return null;
}

function approach(value: number, target: number, amount: number): number {
  if (value < target) return Math.min(target, value + amount);
  if (value > target) return Math.max(target, value - amount);
  return value;
}

function overlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Hitboxes inside a tile: spikes are the lower half, coins and goals are inset. */
export const SPIKE_BOX = { x: 3, y: 7, w: 10, h: 9 };
const COIN_BOX = { x: 3, y: 3, w: 10, h: 10 };
const GOAL_BOX = { x: 2, y: 0, w: 12, h: 16 };

/**
 * One fixed step of 1/120 s. Mutates `body`. Coins are collected into `coins`
 * (a 0/1 flag per tile) when it is given. Spikes are checked before the goal.
 */
export function step(body: Body, input: TickInput, level: Level, coins?: Uint8Array): StepEvent {
  if (input.jumpPressed) body.buffer = BUFFER_TICKS;
  if (input.dir !== 0) body.facing = input.dir;

  const target = input.dir * RUN_SPEED;
  if (input.dir !== 0) body.vx = approach(body.vx, target, (body.onGround ? GROUND_ACCEL : AIR_ACCEL) * DT);
  else body.vx = approach(body.vx, 0, (body.onGround ? GROUND_FRICTION : AIR_FRICTION) * DT);

  if (body.onGround) body.coyote = COYOTE_TICKS;
  else if (body.coyote > 0) body.coyote--;

  if (body.buffer > 0 && body.coyote > 0) {
    body.vy = -JUMP_SPEED;
    body.buffer = 0;
    body.coyote = 0;
    body.canCut = true;
    body.onGround = false;
    body.jumps++;
  } else if (body.buffer > 0) body.buffer--;

  if (body.canCut && !input.jumpHeld && body.vy < 0) {
    body.vy *= JUMP_CUT;
    body.canCut = false;
  }
  if (body.vy >= 0) body.canCut = false;
  body.vy = Math.min(MAX_FALL, body.vy + GRAVITY * DT);

  // Horizontal move, then resolve.
  body.x += body.vx * DT;
  const hitX = overlapsSolid(level, body.x, body.y);
  if (hitX) {
    body.x = body.vx > 0 ? hitX.col * TILE - PLAYER_W : (hitX.col + 1) * TILE;
    // A wall tile from the side: settle exactly and stop.
    const again = overlapsSolid(level, body.x, body.y);
    if (again) body.x = body.vx > 0 ? again.col * TILE - PLAYER_W : (again.col + 1) * TILE;
    body.vx = 0;
  }

  // Vertical move, then resolve.
  body.y += body.vy * DT;
  body.onGround = false;
  const hitY = overlapsSolid(level, body.x, body.y);
  if (hitY) {
    if (body.vy > 0) {
      body.y = hitY.row * TILE - PLAYER_H;
      body.onGround = true;
    } else {
      body.y = (hitY.row + 1) * TILE;
    }
    body.vy = 0;
  }

  if (body.y >= level.h * TILE) return "dead"; // fell into a pit

  const c0 = Math.max(0, Math.floor(body.x / TILE));
  const c1 = Math.min(level.w - 1, Math.floor((body.x + PLAYER_W - 1e-6) / TILE));
  const r0 = Math.max(0, Math.floor(body.y / TILE));
  const r1 = Math.min(level.h - 1, Math.floor((body.y + PLAYER_H - 1e-6) / TILE));
  let goal = false;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const i = r * level.w + c;
      const t = level.tiles[i];
      const tx = c * TILE;
      const ty = r * TILE;
      if (t === TILE_SPIKE && overlap(body.x, body.y, PLAYER_W, PLAYER_H, tx + SPIKE_BOX.x, ty + SPIKE_BOX.y, SPIKE_BOX.w, SPIKE_BOX.h))
        return "dead";
      if (t === TILE_GOAL && overlap(body.x, body.y, PLAYER_W, PLAYER_H, tx + GOAL_BOX.x, ty + GOAL_BOX.y, GOAL_BOX.w, GOAL_BOX.h)) goal = true;
      if (
        coins &&
        t === TILE_COIN &&
        !coins[i] &&
        overlap(body.x, body.y, PLAYER_W, PLAYER_H, tx + COIN_BOX.x, ty + COIN_BOX.y, COIN_BOX.w, COIN_BOX.h)
      )
        coins[i] = 1;
    }
  }
  return goal ? "goal" : null;
}

/**
 * Turns variable frame times into whole fixed steps. Leftover time stays in the
 * accumulator; `alpha` (0..1) is how far the renderer interpolates between the
 * previous and the current step.
 */
export class FixedStepper {
  acc = 0;
  /** Returns the number of steps to run for a frame of `dt` seconds (clamped to MAX_FRAME). */
  advance(dt: number): number {
    const frame = Number.isFinite(dt) && dt > 0 ? Math.min(dt, MAX_FRAME) : 0;
    this.acc += frame;
    let steps = 0;
    while (this.acc >= DT - 1e-9) {
      this.acc -= DT;
      steps++;
    }
    if (this.acc < 0) this.acc = 0;
    return steps;
  }
  get alpha(): number {
    return Math.min(1, this.acc / DT);
  }
  reset() {
    this.acc = 0;
  }
}
