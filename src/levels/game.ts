// One play session: fixed-step physics, coins, deaths, timer and the finish.
// The render loop calls `frame(dt, input)`; tests call the same method with
// synthetic frame times, so 30, 60 and 144 fps run the identical step sequence.

import { TILE_COIN, countTiles, type Level } from "./level.ts";
import { DT, FixedStepper, spawnBody, step, type Body, type TickInput } from "./physics.ts";

export type FrameInput = { dir: -1 | 0 | 1; jumpHeld: boolean; jumpPressed: boolean };
export type GameStatus = "playing" | "finished";
export type GameEvent = { type: "death" } | { type: "coin" } | { type: "finish"; ticks: number };

export class Game {
  readonly level: Level;
  body: Body;
  prev: { x: number; y: number };
  coins: Uint8Array;
  readonly coinTotal: number;
  coinCount = 0;
  deaths = 0;
  ticks = 0;
  /** Steps spent running on the ground (drives the sprite animation). */
  runTicks = 0;
  status: GameStatus = "playing";
  private stepper = new FixedStepper();
  private pendingJump = false;

  constructor(level: Level) {
    this.level = level;
    this.body = spawnBody(level);
    this.prev = { x: this.body.x, y: this.body.y };
    this.coins = new Uint8Array(level.tiles.length);
    this.coinTotal = countTiles(level, TILE_COIN);
  }

  get seconds(): number {
    return this.ticks * DT;
  }

  get alpha(): number {
    return this.stepper.alpha;
  }

  /** Interpolated position for rendering only. */
  renderPos(): { x: number; y: number } {
    const a = this.stepper.alpha;
    return { x: this.prev.x + (this.body.x - this.prev.x) * a, y: this.prev.y + (this.body.y - this.prev.y) * a };
  }

  /** Back to the start; coins, deaths and time reset. */
  retry() {
    this.body = spawnBody(this.level);
    this.prev = { x: this.body.x, y: this.body.y };
    this.coins.fill(0);
    this.coinCount = 0;
    this.deaths = 0;
    this.ticks = 0;
    this.runTicks = 0;
    this.status = "playing";
    this.stepper.reset();
    this.pendingJump = false;
  }

  /** Runs the fixed steps for one rendered frame. The input is the state held during this frame. */
  frame(dt: number, input: FrameInput): GameEvent[] {
    if (input.jumpPressed) this.pendingJump = true;
    if (this.status !== "playing") return [];
    const steps = this.stepper.advance(dt);
    const events: GameEvent[] = [];
    for (let i = 0; i < steps && this.status === "playing"; i++) {
      const tick: TickInput = { dir: input.dir, jumpHeld: input.jumpHeld, jumpPressed: this.pendingJump };
      this.pendingJump = false;
      events.push(...this.tick(tick));
    }
    return events;
  }

  tick(input: TickInput): GameEvent[] {
    const events: GameEvent[] = [];
    this.prev = { x: this.body.x, y: this.body.y };
    const result = step(this.body, input, this.level, this.coins);
    this.ticks++;
    if (this.body.onGround && input.dir !== 0) this.runTicks++;
    let count = 0;
    for (const c of this.coins) count += c;
    if (count > this.coinCount) events.push({ type: "coin" });
    this.coinCount = count;
    if (result === "dead") {
      this.deaths++;
      const jumps = this.body.jumps;
      this.body = spawnBody(this.level);
      this.body.jumps = jumps;
      this.prev = { x: this.body.x, y: this.body.y };
      this.pendingJump = false;
      events.push({ type: "death" });
    } else if (result === "goal") {
      this.status = "finished";
      events.push({ type: "finish", ticks: this.ticks });
    }
    return events;
  }
}

/** An input schedule: from `at` seconds on, hold this input (jump edges fire when `jump` turns on). */
export type ScheduleEntry = { at: number; dir: -1 | 0 | 1; jump: boolean };

/**
 * Plays a level at a fixed render rate, as a browser at `fps` would. Inputs are
 * sampled at the start of every frame. Used by the determinism test and the e2e script.
 */
export function simulate(level: Level, schedule: readonly ScheduleEntry[], fps: number, seconds: number) {
  const game = new Game(level);
  const frames = Math.round(seconds * fps);
  let held = { dir: 0 as -1 | 0 | 1, jump: false };
  const events: GameEvent[] = [];
  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    let next = held;
    for (const entry of schedule) if (entry.at <= t + 1e-9) next = { dir: entry.dir, jump: entry.jump };
    const pressed = next.jump && !held.jump;
    held = next;
    events.push(...game.frame(1 / fps, { dir: held.dir, jumpHeld: held.jump, jumpPressed: pressed }));
  }
  return { game, events };
}
