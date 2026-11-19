// Keyboard and gamepad mapping. Pure helpers so node:test can check them.

export type Mode = "edit" | "play";
export type Direction = "up" | "down" | "left" | "right";
export type Action =
  | { type: "move"; direction: Direction }
  | { type: "paint" }
  | { type: "erase" }
  | { type: "tool"; step: -1 | 1 }
  | { type: "toolSet"; index: number }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "toggle" }
  | { type: "restart" }
  | { type: "jump" };
export type Held = "left" | "right" | "jump";

export type KeyLike = { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean; repeat?: boolean };
export type TargetLike = { tagName?: string; type?: string; isContentEditable?: boolean } | null;

const TEXT_INPUTS = new Set(["text", "search", "email", "url", "tel", "password", "number"]);

export function isTypingTarget(target: TargetLike): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return TEXT_INPUTS.has((target.type ?? "text").toLowerCase());
  return false;
}

export function isRange(target: TargetLike): boolean {
  return (target?.tagName ?? "").toUpperCase() === "INPUT" && (target?.type ?? "").toLowerCase() === "range";
}

function isActivatable(target: TargetLike): boolean {
  const tag = (target?.tagName ?? "").toUpperCase();
  if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return true;
  return tag === "INPUT" && ["checkbox", "radio", "button", "submit", "reset"].includes((target?.type ?? "").toLowerCase());
}

/**
 * Whether a key may act with this element focused. Text fields, number fields,
 * selects, text areas and range sliders keep every key. A focused button, link or
 * checkbox keeps Space and Enter (they press it), the rest still works.
 */
export function shortcutAllowed(target: TargetLike, event: KeyLike): boolean {
  if (isTypingTarget(target) || isRange(target)) return false;
  if (isActivatable(target) && (event.key === " " || event.key === "Enter")) return false;
  return true;
}

/** Keys held for running and jumping in play mode. */
export function heldKey(event: KeyLike): Held | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  switch (event.key) {
    case "ArrowLeft":
    case "a":
    case "A":
      return "left";
    case "ArrowRight":
    case "d":
    case "D":
      return "right";
    case " ":
    case "ArrowUp":
    case "w":
    case "W":
      return "jump";
    default:
      return null;
  }
}

/** One-shot actions. Key repeats never fire, so a key held while the page loads does nothing. */
export function keyAction(event: KeyLike, mode: Mode): Action | null {
  if (event.repeat && !(mode === "edit" && event.key.startsWith("Arrow"))) return null;
  const mod = event.ctrlKey || event.metaKey;
  if (mod && !event.altKey) {
    if (mode !== "edit") return null;
    const key = event.key.toLowerCase();
    if (key === "z") return event.shiftKey ? { type: "redo" } : { type: "undo" };
    if (key === "y") return { type: "redo" };
    return null;
  }
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  if (event.key === "Enter") return { type: "toggle" };
  if (mode === "play") {
    if (event.key === "r" || event.key === "R") return { type: "restart" };
    if (event.key === "Escape") return { type: "toggle" };
    return heldKey(event) === "jump" ? { type: "jump" } : null;
  }
  switch (event.key) {
    case "ArrowUp":
      return { type: "move", direction: "up" };
    case "ArrowDown":
      return { type: "move", direction: "down" };
    case "ArrowLeft":
      return { type: "move", direction: "left" };
    case "ArrowRight":
      return { type: "move", direction: "right" };
    case " ":
      return { type: "paint" };
    case "Backspace":
    case "Delete":
      return { type: "erase" };
    case "q":
    case "Q":
      return { type: "tool", step: -1 };
    case "e":
    case "E":
      return { type: "tool", step: 1 };
    default:
      if (/^[1-6]$/.test(event.key)) return { type: "toolSet", index: Number(event.key) - 1 };
      return null;
  }
}

// Standard gamepad mapping (PlayStation labels). 100–103 are the left stick as virtual buttons.
export const PAD = {
  cross: 0,
  circle: 1,
  square: 2,
  triangle: 3,
  l1: 4,
  r1: 5,
  l2: 6,
  r2: 7,
  options: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
  stickLeft: 100,
  stickRight: 101,
  stickUp: 102,
  stickDown: 103,
} as const;
export const STICK_THRESHOLD = 0.5;
const WATCHED = [0, 1, 2, 3, 4, 5, 6, 7, 9, 12, 13, 14, 15, 100, 101, 102, 103];

export type PadLike = { index: number; id?: string; buttons: readonly { pressed: boolean; value?: number }[]; axes?: readonly number[] };
export type PadMemory = { id: string; prev: Record<number, boolean>; armed: Record<number, boolean> };
export type PadPoll = { edges: Set<number>; held: Set<number>; memory: PadMemory | null };

export function readButtons(pad: PadLike): Record<number, boolean> {
  const out: Record<number, boolean> = {};
  for (const index of WATCHED) {
    if (index < 100) {
      const b = pad.buttons[index];
      out[index] = Boolean(b && (b.pressed || (b.value ?? 0) > 0.5));
    }
  }
  const x = pad.axes?.[0] ?? 0;
  const y = pad.axes?.[1] ?? 0;
  out[PAD.stickLeft] = x < -STICK_THRESHOLD;
  out[PAD.stickRight] = x > STICK_THRESHOLD;
  out[PAD.stickUp] = y < -STICK_THRESHOLD;
  out[PAD.stickDown] = y > STICK_THRESHOLD;
  return out;
}

function seed(pad: PadLike, now: Record<number, boolean>): PadMemory {
  const armed: Record<number, boolean> = {};
  for (const index of WATCHED) armed[index] = !now[index];
  return { id: pad.id ?? "", prev: now, armed };
}

/**
 * One pad, one poll (the pollPad pattern). No memory, another pad on this slot, or
 * blocked (a field has focus): only store the state and report nothing. A button
 * that was already down then stays dead until it has been released once, so a
 * button held while the page loads neither jumps nor runs.
 */
export function pollPad(pad: PadLike | null, memory: PadMemory | null, blocked = false): PadPoll {
  if (!pad) return { edges: new Set(), held: new Set(), memory: null };
  const now = readButtons(pad);
  if (!memory || memory.id !== (pad.id ?? "") || blocked) return { edges: new Set(), held: new Set(), memory: seed(pad, now) };
  const edges = new Set<number>();
  const held = new Set<number>();
  const armed: Record<number, boolean> = { ...memory.armed };
  for (const index of WATCHED) {
    if (!now[index]) armed[index] = true;
    if (now[index] && armed[index]) {
      held.add(index);
      if (!memory.prev[index]) edges.add(index);
    }
  }
  return { edges, held, memory: { id: memory.id, prev: now, armed } };
}

/** Memory per gamepad slot. A pad missing from a poll (or forgotten on disconnect) seeds again. */
export function createPadPoller() {
  const memories = new Map<number, PadMemory>();
  return {
    poll(pads: readonly (PadLike | null)[], blocked = false): { edges: Set<number>; held: Set<number> } {
      const edges = new Set<number>();
      const held = new Set<number>();
      const live = new Set<number>();
      for (const pad of pads) {
        if (!pad) continue;
        live.add(pad.index);
        const result = pollPad(pad, memories.get(pad.index) ?? null, blocked);
        if (result.memory) memories.set(pad.index, result.memory);
        for (const e of result.edges) edges.add(e);
        for (const h of result.held) held.add(h);
      }
      for (const index of [...memories.keys()]) if (!live.has(index)) memories.delete(index);
      return { edges, held };
    },
    forget(index: number) {
      memories.delete(index);
    },
  };
}

/** Pad edges to actions for the current mode. */
export function padActions(edges: Set<number>, mode: Mode): Action[] {
  const actions: Action[] = [];
  if (edges.has(PAD.options)) actions.push({ type: "toggle" });
  if (mode === "play") {
    if (edges.has(PAD.cross)) actions.push({ type: "jump" });
    if (edges.has(PAD.circle)) actions.push({ type: "restart" });
    return actions;
  }
  if (edges.has(PAD.up) || edges.has(PAD.stickUp)) actions.push({ type: "move", direction: "up" });
  if (edges.has(PAD.down) || edges.has(PAD.stickDown)) actions.push({ type: "move", direction: "down" });
  if (edges.has(PAD.left) || edges.has(PAD.stickLeft)) actions.push({ type: "move", direction: "left" });
  if (edges.has(PAD.right) || edges.has(PAD.stickRight)) actions.push({ type: "move", direction: "right" });
  if (edges.has(PAD.cross)) actions.push({ type: "paint" });
  if (edges.has(PAD.circle)) actions.push({ type: "erase" });
  if (edges.has(PAD.l1)) actions.push({ type: "tool", step: -1 });
  if (edges.has(PAD.r1)) actions.push({ type: "tool", step: 1 });
  if (edges.has(PAD.l2)) actions.push({ type: "undo" });
  if (edges.has(PAD.r2)) actions.push({ type: "redo" });
  return actions;
}

/** Held pad buttons to the play input (run with D-pad or stick, jump with ×). */
export function padHeld(held: Set<number>): { left: boolean; right: boolean; jump: boolean } {
  return {
    left: held.has(PAD.left) || held.has(PAD.stickLeft),
    right: held.has(PAD.right) || held.has(PAD.stickRight),
    jump: held.has(PAD.cross),
  };
}
