import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { simulate } from "./game.ts";
import { Game } from "./game.ts";
import { levelFromRows } from "./level.ts";
import { DT } from "./physics.ts";
import { PAD, createPadPoller, heldKey, keyAction, padActions, padHeld, pollPad, shortcutAllowed, type PadLike } from "./input.ts";

function pad(pressed: number[], opts: { index?: number; id?: string; axes?: number[] } = {}): PadLike {
  return {
    index: opts.index ?? 0,
    id: opts.id ?? "pad",
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
    axes: opts.axes ?? [0, 0, 0, 0],
  };
}

test("the first poll only stores the state: a held × neither jumps nor counts as held", () => {
  const first = pollPad(pad([PAD.cross, PAD.right]), null);
  assert.equal(first.edges.size, 0);
  assert.equal(first.held.size, 0);
  // Still held: nothing, because the button was down at the first poll.
  const second = pollPad(pad([PAD.cross, PAD.right]), first.memory);
  assert.equal(second.edges.size, 0);
  assert.equal(second.held.size, 0);
  // Released, then pressed again: now it fires.
  const released = pollPad(pad([]), second.memory);
  const pressed = pollPad(pad([PAD.cross]), released.memory);
  assert.deepEqual([...pressed.edges], [PAD.cross]);
  assert.deepEqual([...pressed.held], [PAD.cross]);
  // A button that was up at the first poll works right away on its next press.
  const fresh = pollPad(pad([]), null);
  assert.deepEqual([...pollPad(pad([PAD.circle]), fresh.memory).edges], [PAD.circle]);
});

test("reconnect, another pad on the slot and a focused field reseed the memory", () => {
  const poller = createPadPoller();
  assert.equal(poller.poll([pad([])]).edges.size, 0);
  assert.deepEqual([...poller.poll([pad([PAD.cross])]).edges], [PAD.cross]);
  // Disconnect (pad missing), reconnect with × held: inert.
  poller.poll([]);
  assert.equal(poller.poll([pad([PAD.cross])]).edges.size, 0);
  assert.equal(poller.poll([pad([PAD.cross])]).held.size, 0);
  // forget() on gamepaddisconnected, same thing.
  poller.poll([pad([])]);
  poller.forget(0);
  assert.equal(poller.poll([pad([PAD.options])]).edges.size, 0);
  // Another controller in the same slot.
  poller.poll([pad([])]);
  assert.equal(poller.poll([pad([PAD.cross], { id: "other" })]).edges.size, 0);
  // Blocked by a focused field: nothing fires and the held button stays dead afterwards.
  const p2 = createPadPoller();
  p2.poll([pad([])]);
  assert.equal(p2.poll([pad([PAD.cross])], true).edges.size, 0);
  assert.equal(p2.poll([pad([PAD.cross])]).edges.size, 0);
  // Two pads are tracked separately.
  const p3 = createPadPoller();
  p3.poll([pad([], { index: 0 }), pad([], { index: 1 })]);
  assert.deepEqual([...p3.poll([pad([], { index: 0 }), pad([PAD.circle], { index: 1 })]).edges], [PAD.circle]);
});

test("a × held while the page loads does not make the player jump", () => {
  const level = levelFromRows([
    "................",
    "................",
    "................",
    "................",
    ".S............G.",
    "################",
  ]);
  const game = new Game(level);
  const poller = createPadPoller();
  const startY: number[] = [];
  for (let f = 0; f < 120; f++) {
    const polled = poller.poll([pad([PAD.cross])]);
    const held = padHeld(polled.held);
    const jump = padActions(polled.edges, "play").some((a) => a.type === "jump");
    game.frame(1 / 60, { dir: 0, jumpHeld: held.jump, jumpPressed: jump });
    if (f > 30) startY.push(game.body.y);
  }
  assert.ok(
    startY.every((y) => y === startY[0]),
    "never left the ground",
  );
  assert.ok(game.body.onGround);
  assert.equal(game.body.jumps, 0);
  // After a release and a new press it jumps.
  poller.poll([pad([])]);
  const polled = poller.poll([pad([PAD.cross])]);
  game.frame(DT * 4, { dir: 0, jumpHeld: padHeld(polled.held).jump, jumpPressed: padActions(polled.edges, "play").some((a) => a.type === "jump") });
  assert.ok(game.body.vy < 0);
  assert.ok(simulate(level, [], 60, 0.1).game.body.vy >= 0);
});

test("pad mapping for play and editor", () => {
  assert.deepEqual(padActions(new Set([PAD.cross, PAD.circle, PAD.options]), "play"), [{ type: "toggle" }, { type: "jump" }, { type: "restart" }]);
  assert.deepEqual(padActions(new Set([PAD.up, PAD.cross, PAD.circle, PAD.l1, PAD.r1, PAD.l2, PAD.r2]), "edit"), [
    { type: "move", direction: "up" },
    { type: "paint" },
    { type: "erase" },
    { type: "tool", step: -1 },
    { type: "tool", step: 1 },
    { type: "undo" },
    { type: "redo" },
  ]);
  assert.deepEqual(padActions(new Set([PAD.stickRight]), "edit"), [{ type: "move", direction: "right" }]);
  const start = pollPad(pad([], { axes: [0, 0] }), null);
  const stick = pollPad(pad([], { axes: [-0.9, 0] }), start.memory);
  assert.deepEqual(padHeld(stick.held), { left: true, right: false, jump: false });
  const small = pollPad(pad([], { axes: [0.3, 0] }), start.memory);
  assert.deepEqual(padHeld(small.held), { left: false, right: false, jump: false });
  // An analog trigger counts as pressed above 0.5.
  const trig: PadLike = { index: 0, id: "pad", buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: false, value: i === PAD.l2 ? 0.8 : 0 })) };
  assert.deepEqual(padActions(pollPad(trig, pollPad(pad([]), null).memory).edges, "edit"), [{ type: "undo" }]);
});

test("keyboard mapping; key repeats never fire one-shot actions", () => {
  assert.equal(heldKey({ key: "ArrowLeft" }), "left");
  assert.equal(heldKey({ key: "d" }), "right");
  assert.equal(heldKey({ key: " " }), "jump");
  assert.equal(heldKey({ key: "W" }), "jump");
  assert.equal(heldKey({ key: "ArrowUp" }), "jump");
  assert.deepEqual(keyAction({ key: " " }, "play"), { type: "jump" });
  assert.equal(keyAction({ key: " ", repeat: true }, "play"), null);
  assert.deepEqual(keyAction({ key: "r" }, "play"), { type: "restart" });
  assert.deepEqual(keyAction({ key: "Enter" }, "play"), { type: "toggle" });
  assert.deepEqual(keyAction({ key: "Enter" }, "edit"), { type: "toggle" });
  assert.deepEqual(keyAction({ key: "z", ctrlKey: true }, "edit"), { type: "undo" });
  assert.deepEqual(keyAction({ key: "y", ctrlKey: true }, "edit"), { type: "redo" });
  assert.deepEqual(keyAction({ key: "Z", metaKey: true, shiftKey: true }, "edit"), { type: "redo" });
  assert.deepEqual(keyAction({ key: "ArrowLeft", repeat: true }, "edit"), { type: "move", direction: "left" });
  assert.deepEqual(keyAction({ key: " " }, "edit"), { type: "paint" });
  assert.deepEqual(keyAction({ key: "Backspace" }, "edit"), { type: "erase" });
  assert.deepEqual(keyAction({ key: "e" }, "edit"), { type: "tool", step: 1 });
  assert.deepEqual(keyAction({ key: "3" }, "edit"), { type: "toolSet", index: 2 });
  assert.equal(keyAction({ key: "7" }, "edit"), null);
  assert.equal(keyAction({ key: "z", ctrlKey: true }, "play"), null);
});

test("no shortcuts in text fields, number fields, selects or range sliders; buttons keep Space and Enter", () => {
  for (const target of [
    { tagName: "INPUT", type: "text" },
    { tagName: "INPUT", type: "number" },
    { tagName: "INPUT", type: "range" },
    { tagName: "SELECT" },
    { tagName: "TEXTAREA" },
    { tagName: "DIV", isContentEditable: true },
  ]) {
    for (const key of [" ", "ArrowLeft", "Enter", "r", "z"])
      assert.equal(shortcutAllowed(target, { key, ctrlKey: key === "z" }), false, `${target.tagName} ${key}`);
  }
  assert.equal(shortcutAllowed({ tagName: "BUTTON" }, { key: " " }), false);
  assert.equal(shortcutAllowed({ tagName: "BUTTON" }, { key: "Enter" }), false);
  assert.equal(shortcutAllowed({ tagName: "BUTTON" }, { key: "ArrowLeft" }), true);
  assert.equal(shortcutAllowed({ tagName: "INPUT", type: "checkbox" }, { key: " " }), false);
  assert.equal(shortcutAllowed({ tagName: "CANVAS" }, { key: " " }), true);
  assert.equal(shortcutAllowed(null, { key: " " }), true);
  const ui = readFileSync(new URL("./LevelEditor.tsx", import.meta.url), "utf8");
  assert.match(ui, /shortcutAllowed\(target, event\)/);
  assert.match(ui, /poller\.poll\(pads, blocked\)/);
  assert.match(ui, /gamepaddisconnected/);
});
