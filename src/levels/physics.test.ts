import assert from "node:assert/strict";
import test from "node:test";
import { Game, simulate, type ScheduleEntry } from "./game.ts";
import { levelFromRows } from "./level.ts";
import {
  BUFFER_TICKS,
  COYOTE_TICKS,
  DT,
  FixedStepper,
  MAX_FRAME,
  MAX_JUMP_DISTANCE,
  MAX_JUMP_HEIGHT,
  PLAYER_H,
  TILE,
  spawnBody,
  step,
  type TickInput,
} from "./physics.ts";
import { sampleLevel, samples } from "./samples.ts";

const idle: TickInput = { dir: 0, jumpHeld: false, jumpPressed: false };

/** Hold right; jump on for 1/3 s every 0.5 s. All change times are multiples of 1/6 s. */
export const FIRST_STEPS_SCRIPT: ScheduleEntry[] = Array.from({ length: 60 }, (_, k) => ({ at: k / 6, dir: 1 as const, jump: k % 3 < 2 }));

const zigzag: ScheduleEntry[] = [
  { at: 0, dir: 1, jump: false },
  { at: 0.5, dir: 1, jump: true },
  { at: 0.6666666666666666, dir: 1, jump: false },
  { at: 1, dir: -1, jump: false },
  { at: 1.5, dir: -1, jump: true },
  { at: 2, dir: 0, jump: false },
  { at: 2.5, dir: 1, jump: true },
  { at: 3, dir: 1, jump: false },
];

function flat(rows = 9, w = 20): string[] {
  const out: string[] = [];
  for (let y = 0; y < rows; y++) out.push(".".repeat(w));
  out[rows - 2] = ".S" + ".".repeat(w - 4) + "G.";
  out[rows - 1] = "#".repeat(w);
  return out;
}

test("the fixed timestep gives identical positions and outcome at 30, 60 and 144 fps", () => {
  for (const [name, level, schedule, seconds] of [
    ["first steps", sampleLevel(samples[0], "de"), FIRST_STEPS_SCRIPT, 8],
    ["spike garden zigzag", sampleLevel(samples[1], "de"), zigzag, 4],
    ["tower zigzag", sampleLevel(samples[2], "de"), zigzag, 3.5],
  ] as const) {
    const runs = [30, 60, 144].map((fps) => simulate(level, schedule, fps, seconds));
    const view = (r: (typeof runs)[number]) => ({
      x: r.game.body.x,
      y: r.game.body.y,
      vx: r.game.body.vx,
      vy: r.game.body.vy,
      ticks: r.game.ticks,
      coins: r.game.coinCount,
      deaths: r.game.deaths,
      status: r.game.status,
      events: r.events.map((e) => e.type).join(","),
    });
    assert.deepEqual(view(runs[1]), view(runs[0]), `${name}: 60 vs 30`);
    assert.deepEqual(view(runs[2]), view(runs[0]), `${name}: 144 vs 30`);
  }
});

test("the first sample is beaten by the scripted input at every render rate", () => {
  for (const fps of [30, 60, 144]) {
    const { game, events } = simulate(sampleLevel(samples[0], "de"), FIRST_STEPS_SCRIPT, fps, 8);
    assert.equal(game.status, "finished", `fps ${fps}`);
    assert.equal(game.deaths, 0);
    assert.ok(game.coinCount >= 3);
    assert.ok(events.some((e) => e.type === "finish"));
    assert.ok(game.seconds > 3 && game.seconds < 6, String(game.seconds));
  }
});

test("the stepper clamps long frames and keeps the remainder for interpolation", () => {
  const s = new FixedStepper();
  assert.equal(s.advance(5), Math.round(MAX_FRAME / DT));
  s.reset();
  assert.equal(s.advance(DT / 2), 0);
  assert.ok(Math.abs(s.alpha - 0.5) < 1e-6);
  assert.equal(s.advance(DT / 2), 1);
  assert.equal(s.advance(Number.NaN), 0);
  assert.equal(s.advance(-1), 0);
  const g = new Game(levelFromRows(flat()));
  g.frame(DT * 1.5, { dir: 1, jumpHeld: false, jumpPressed: false });
  const pos = g.renderPos();
  assert.ok(pos.x >= g.prev.x && pos.x <= g.body.x);
});

test("collisions: lands on the floor, stops at walls, bumps the ceiling, never enters a block", () => {
  const level = levelFromRows(["..........", "..........", "....#.....", "..........", ".S.....#..", "##########"]);
  const body = spawnBody(level);
  for (let i = 0; i < 60; i++) step(body, idle, level);
  assert.equal(body.onGround, true);
  assert.equal(body.y, 5 * TILE - PLAYER_H);
  // Run right into the wall at column 7.
  for (let i = 0; i < 240; i++) step(body, { dir: 1, jumpHeld: false, jumpPressed: false }, level);
  assert.equal(body.x + 12, 7 * TILE);
  assert.equal(body.vx, 0);
  // Jump under the block at column 4: the head stops at its underside.
  const b2 = spawnBody(level);
  for (let i = 0; i < 30; i++) step(b2, idle, level);
  b2.x = 4 * TILE + 2;
  let minY = b2.y;
  step(b2, { dir: 0, jumpHeld: true, jumpPressed: true }, level);
  for (let i = 0; i < 60; i++) {
    step(b2, { dir: 0, jumpHeld: true, jumpPressed: false }, level);
    minY = Math.min(minY, b2.y);
  }
  assert.equal(minY, 3 * TILE);
  // Side walls hold the player in.
  const b3 = spawnBody(level);
  for (let i = 0; i < 240; i++) step(b3, { dir: -1, jumpHeld: false, jumpPressed: false }, level);
  assert.equal(b3.x, 0);
});

test("spikes kill and respawn at the start; a pit kills; the goal finishes", () => {
  const spikes = levelFromRows(["..........", ".S..^...G.", "##########"]);
  const g = new Game(spikes);
  for (let i = 0; i < 240 && g.deaths === 0; i++) g.tick({ dir: 1, jumpHeld: false, jumpPressed: false });
  assert.equal(g.deaths, 1);
  assert.equal(g.body.x, spawnBody(spikes).x);
  const pit = levelFromRows(["..........", ".S......G.", "###..#####"]);
  const p = new Game(pit);
  for (let i = 0; i < 400 && p.deaths === 0; i++) p.tick({ dir: 1, jumpHeld: false, jumpPressed: false });
  assert.equal(p.deaths, 1);
  const goal = levelFromRows(["..........", ".S.o..G...", "##########"]);
  const q = new Game(goal);
  for (let i = 0; i < 400 && q.status === "playing"; i++) q.tick({ dir: 1, jumpHeld: false, jumpPressed: false });
  assert.equal(q.status, "finished");
  assert.equal(q.coinCount, 1);
  assert.equal(q.coinTotal, 1);
  const frozen = q.ticks;
  q.frame(1, { dir: 1, jumpHeld: false, jumpPressed: false });
  assert.equal(q.ticks, frozen, "the timer stops at the finish");
});

test("variable jump height: a short press jumps lower than a held one, and the full jump matches v²/2g", () => {
  const level = levelFromRows(flat(12));
  function peak(holdTicks: number): number {
    const body = spawnBody(level);
    for (let i = 0; i < 30; i++) step(body, idle, level);
    const ground = body.y;
    let top = body.y;
    for (let t = 0; t < 120; t++) {
      step(body, { dir: 0, jumpHeld: t < holdTicks, jumpPressed: t === 0 }, level);
      top = Math.min(top, body.y);
    }
    return ground - top;
  }
  const full = peak(1000);
  const short = peak(6);
  assert.ok(short < full * 0.6, `${short} vs ${full}`);
  assert.ok(Math.abs(full - MAX_JUMP_HEIGHT) < 4, `${full} vs ${MAX_JUMP_HEIGHT}`);
  assert.ok(MAX_JUMP_HEIGHT > 3 * TILE && MAX_JUMP_HEIGHT < 4 * TILE);
  assert.ok(MAX_JUMP_DISTANCE > 3 * TILE && MAX_JUMP_DISTANCE < 4 * TILE);
});

test("coyote time allows a jump shortly after leaving a ledge, but not later", () => {
  const level = levelFromRows(["..............", "..............", "..............", "..............", ".S............", "###..........."]);
  function jumpAfterLeaving(delay: number): boolean {
    const body = spawnBody(level);
    for (let i = 0; i < 30; i++) step(body, idle, level);
    let leftAt = -1;
    for (let t = 0; t < 200; t++) {
      const press = leftAt >= 0 && t === leftAt + delay;
      step(body, { dir: 1, jumpHeld: true, jumpPressed: press }, level);
      if (press) return body.vy < 0;
      if (leftAt < 0 && !body.onGround) leftAt = t + 1;
    }
    return false;
  }
  assert.equal(jumpAfterLeaving(1), true);
  assert.equal(jumpAfterLeaving(COYOTE_TICKS - 2), true);
  assert.equal(jumpAfterLeaving(COYOTE_TICKS + 3), false);
});

test("the jump buffer jumps on landing if pressed shortly before, but not too early", () => {
  const level = levelFromRows(flat(12));
  function landsAndJumps(ticksBefore: number): boolean {
    const body = spawnBody(level);
    body.y -= 3 * TILE; // drop from above
    // Find the landing tick first.
    const probe = { ...body };
    let land = 0;
    for (let t = 0; t < 300; t++) {
      step(probe, idle, level);
      if (probe.onGround) {
        land = t;
        break;
      }
    }
    for (let t = 0; t <= land + 3; t++) {
      step(body, { dir: 0, jumpHeld: true, jumpPressed: t === land - ticksBefore }, level);
    }
    return body.vy < 0;
  }
  assert.equal(landsAndJumps(3), true);
  assert.equal(landsAndJumps(BUFFER_TICKS - 2), true);
  assert.equal(landsAndJumps(BUFFER_TICKS + 6), false);
});
