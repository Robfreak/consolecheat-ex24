import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPadPoller, heldKey, keyAction, padActions, padHeld, shortcutAllowed, type Action, type Mode } from "./input.ts";
import { Game, type GameEvent } from "./game.ts";
import {
  MAX_H,
  MAX_W,
  MIN_H,
  MIN_W,
  TILE_EMPTY,
  TILE_SOLID,
  cleanTitle,
  cloneLevel,
  emptyLevel,
  fillRow,
  levelProblems,
  paint,
  resizeLevel,
  tileAt,
  validSize,
  type Level,
  type Tile,
} from "./level.ts";
import { fill, formatTime, type Copy, type Lang } from "./messages.ts";
import { TILE } from "./physics.ts";
import { analyzeReach, type ReachResult } from "./reach.ts";
import { drawLevel, drawPlayer, palette, spriteCanvases } from "./render.ts";
import { sampleLevel, samples } from "./samples.ts";
import { decodeLevel, encodeLevel, isLevelHash } from "./share.ts";
import { readSprite, spriteFrame, type SpriteResult } from "./sprite.ts";
import {
  TOOLS,
  deleteLevel,
  levelHash,
  loadStore,
  recordBest,
  saveLevel,
  saveStore,
  type StorageLike,
  type Store,
  type ToolName,
} from "./storage.ts";

const TOOL_TILES: Record<ToolName, Tile> = { empty: 0, solid: 1, spike: 2, coin: 3, start: 4, goal: 5 };
const HISTORY_MAX = 100;

function localStore(): StorageLike | null {
  try {
    localStorage.getItem("consolecheat-theme");
    return localStorage;
  } catch {
    return null;
  }
}

function themeNow(): "light" | "dark" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function media(query: string): boolean {
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

type LinkState = { level: Level; message: { kind: "ok" | "bad"; key: string } | null };

function initialFromHash(lang: Lang): LinkState {
  const fallback = sampleLevel(samples[0], lang);
  if (!isLevelHash(location.hash)) return { level: fallback, message: null };
  try {
    const result = decodeLevel(location.hash);
    if (result.ok) return { level: result.level, message: { kind: "ok", key: "linkOpened" } };
    return { level: fallback, message: { kind: "bad", key: result.error } };
  } catch {
    return { level: fallback, message: { kind: "bad", key: "broken" } };
  }
}

export function LevelEditor({ text, lang }: { text: Copy; lang: Lang }) {
  const storage = useMemo(localStore, []);
  const loaded = useMemo(() => loadStore(storage), [storage]);
  const first = useMemo(() => initialFromHash(lang), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [store, setStore] = useState<Store>(loaded.store);
  const [level, setLevel] = useState<Level>(first.level);
  const [mode, setMode] = useState<Mode>("edit");
  const [tool, setTool] = useState<ToolName>(loaded.store.settings.tool);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [undoStack, setUndoStack] = useState<Level[]>([]);
  const [redoStack, setRedoStack] = useState<Level[]>([]);
  const [reach, setReach] = useState<ReachResult | null>(null);
  const [status, setStatus] = useState(first.message?.kind === "ok" ? text.linkOpened : "");
  const [error, setError] = useState(
    first.message?.kind === "bad" ? text.linkErrors[first.message.key as keyof Copy["linkErrors"]] : loaded.corrupt ? text.storeCorrupt : "",
  );
  const [shareUrl, setShareUrl] = useState("");
  const [sizeW, setSizeW] = useState(String(first.level.w));
  const [sizeH, setSizeH] = useState(String(first.level.h));
  const [hud, setHud] = useState({ time: 0, coins: 0, total: 0, deaths: 0, finished: false, jumps: 0 });
  const [sprite, setSprite] = useState<SpriteResult>(() => readSprite(storage));
  const [touch] = useState(() => media("(pointer: coarse)") || (typeof window !== "undefined" && "ontouchstart" in window));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playAreaRef = useRef<HTMLDivElement | null>(null);
  const levelRef = useRef(level);
  const modeRef = useRef(mode);
  const cursorRef = useRef(cursor);
  const toolRef = useRef(tool);
  const gameRef = useRef<Game | null>(null);
  const keysHeld = useRef({ left: false, right: false, jump: false });
  const touchHeld = useRef({ left: false, right: false, jump: false });
  const jumpPress = useRef(false);
  const strokeRef = useRef<{ before: Level; changed: boolean; erase: boolean } | null>(null);
  const actRef = useRef<(action: Action) => void>(() => {});
  const spriteFramesRef = useRef<HTMLCanvasElement[] | null>(null);
  const storeRef = useRef(store);
  const textRef = useRef(text);
  levelRef.current = level;
  modeRef.current = mode;
  cursorRef.current = cursor;
  toolRef.current = tool;
  storeRef.current = store;
  textRef.current = text;

  const problems = levelProblems(level);
  const useSprite = store.settings.sprite && sprite.ok;

  useEffect(() => {
    spriteFramesRef.current = sprite.ok ? spriteCanvases(sprite.sprite) : null;
  }, [sprite]);

  const persist = useCallback(
    (next: Store) => {
      setStore(next);
      if (!saveStore(storage, next)) setError(textRef.current.saveFailed);
    },
    [storage],
  );

  // Reachability check, debounced after edits.
  useEffect(() => {
    setReach(null);
    if (levelProblems(level).length) return;
    const id = window.setTimeout(() => setReach(analyzeReach(level)), 120);
    return () => window.clearTimeout(id);
  }, [level]);

  const commit = useCallback((next: Level, before: Level) => {
    setUndoStack((stack) => [...stack.slice(-(HISTORY_MAX - 1)), before]);
    setRedoStack([]);
    setLevel(next);
    setShareUrl("");
  }, []);

  function loadLevel(next: Level, message = "") {
    setLevel(next);
    setUndoStack([]);
    setRedoStack([]);
    setSizeW(String(next.w));
    setSizeH(String(next.h));
    setCursor({ x: 0, y: 0 });
    setShareUrl("");
    setMode("edit");
    gameRef.current = null;
    setStatus(message);
    setError("");
  }

  // Shared links pasted while the page is open.
  useEffect(() => {
    function onHash() {
      if (!isLevelHash(location.hash)) return;
      const result = decodeLevel(location.hash);
      if (result.ok) loadLevel(result.level, textRef.current.linkOpened);
      else setError(textRef.current.linkErrors[result.error]);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function paintAt(x: number, y: number, erase: boolean, base?: Level) {
    const src = base ?? levelRef.current;
    const next = cloneLevel(src);
    const tile = erase ? TILE_EMPTY : TOOL_TILES[toolRef.current];
    if (!paint(next, x, y, tile as Tile)) return null;
    return next;
  }

  function undo() {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack([...redoStack, level]);
    setLevel(prev);
    setSizeW(String(prev.w));
    setSizeH(String(prev.h));
    setShareUrl("");
  }

  function redo() {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack([...undoStack, level]);
    setLevel(next);
    setSizeW(String(next.w));
    setSizeH(String(next.h));
    setShareUrl("");
  }

  function chooseTool(next: ToolName) {
    setTool(next);
    persist({ ...storeRef.current, settings: { ...storeRef.current.settings, tool: next } });
  }

  function startPlay() {
    const current = levelRef.current;
    if (levelProblems(current).length) {
      setError(textRef.current.playBlocked);
      return;
    }
    gameRef.current = new Game(cloneLevel(current));
    keysHeld.current = { left: false, right: false, jump: false };
    jumpPress.current = false;
    setHud({ time: 0, coins: 0, total: gameRef.current.coinTotal, deaths: 0, finished: false, jumps: 0 });
    setMode("play");
    setError("");
    setStatus(reach && reach.complete && !reach.reachable ? textRef.current.reachPlayNotice : "");
    requestAnimationFrame(() => {
      canvasRef.current?.focus({ preventScroll: true });
      playAreaRef.current?.scrollIntoView({ block: "nearest", behavior: media("(prefers-reduced-motion: reduce)") ? "auto" : "smooth" });
    });
  }

  function stopPlay() {
    gameRef.current = null;
    setMode("edit");
    setStatus("");
    requestAnimationFrame(() => canvasRef.current?.focus());
  }

  function retry() {
    gameRef.current?.retry();
    jumpPress.current = false;
    setStatus("");
    const g = gameRef.current;
    if (g) setHud({ time: 0, coins: 0, total: g.coinTotal, deaths: 0, finished: false, jumps: 0 });
  }

  function onEvents(events: GameEvent[]) {
    const g = gameRef.current;
    if (!g) return;
    const t = textRef.current;
    for (const event of events) {
      if (event.type === "death") setStatus(t.died);
      else if (event.type === "coin") setStatus(fill(t.coin, { coins: g.coinCount, total: g.coinTotal }));
      else if (event.type === "finish") {
        const ms = Math.round(g.seconds * 1000);
        const { store: next, isBest } = recordBest(storeRef.current, levelHash(g.level), ms, g.coinCount, new Date());
        if (isBest) persist(next);
        setStatus(
          `${fill(t.finished, { time: formatTime(g.seconds), coins: g.coinCount, total: g.coinTotal, deaths: g.deaths })}${isBest ? ` ${t.finishedBest}` : ""}`,
        );
      }
    }
  }

  // One handler for keyboard, pad and buttons.
  actRef.current = (action: Action) => {
    const m = modeRef.current;
    if (action.type === "toggle") {
      if (m === "edit") startPlay();
      else stopPlay();
      return;
    }
    if (m === "play") {
      if (action.type === "restart") retry();
      else if (action.type === "jump") jumpPress.current = true;
      return;
    }
    const c = cursorRef.current;
    const lv = levelRef.current;
    switch (action.type) {
      case "move": {
        const dx = action.direction === "left" ? -1 : action.direction === "right" ? 1 : 0;
        const dy = action.direction === "up" ? -1 : action.direction === "down" ? 1 : 0;
        setCursor({ x: Math.min(lv.w - 1, Math.max(0, c.x + dx)), y: Math.min(lv.h - 1, Math.max(0, c.y + dy)) });
        break;
      }
      case "paint":
      case "erase": {
        const next = paintAt(c.x, c.y, action.type === "erase");
        if (next) commit(next, lv);
        break;
      }
      case "tool": {
        const i = TOOLS.indexOf(toolRef.current);
        chooseTool(TOOLS[(i + action.step + TOOLS.length) % TOOLS.length]);
        break;
      }
      case "toolSet":
        if (TOOLS[action.index]) chooseTool(TOOLS[action.index]);
        break;
      case "undo":
        undo();
        break;
      case "redo":
        redo();
        break;
      default:
        break;
    }
  };

  // Keyboard.
  useEffect(() => {
    function down(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (!shortcutAllowed(target, event)) return;
      const held = heldKey(event);
      const m = modeRef.current;
      if (m === "play" && held) {
        keysHeld.current[held] = true;
        event.preventDefault();
      }
      const action = keyAction(event, m);
      if (action) {
        event.preventDefault();
        actRef.current(action);
      }
    }
    function up(event: KeyboardEvent) {
      const held = heldKey({ key: event.key });
      if (held) keysHeld.current[held] = false;
    }
    function blur() {
      keysHeld.current = { left: false, right: false, jump: false };
      touchHeld.current = { left: false, right: false, jump: false };
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // The loop: gamepad poll every frame (also in the editor, so the first poll only seeds), physics, drawing.
  useEffect(() => {
    const poller = createPadPoller();
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    const motion = !media("(prefers-reduced-motion: reduce)");
    function onDisconnect(event: GamepadEvent) {
      poller.forget(event.gamepad.index);
    }
    window.addEventListener("gamepaddisconnected", onDisconnect);
    function loop(now: number) {
      const dt = (now - last) / 1000;
      last = now;
      let pads: (Gamepad | null)[] = [];
      try {
        pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
      } catch {
        pads = [];
      }
      const blocked = !shortcutAllowed(document.activeElement as HTMLElement | null, { key: "Tab" });
      const polled = poller.poll(pads, blocked);
      const m = modeRef.current;
      for (const action of padActions(polled.edges, m)) actRef.current(action);
      const padHold = padHeld(polled.held);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const colors = palette(themeNow());
      const lv = levelRef.current;
      const g = modeRef.current === "play" ? gameRef.current : null;
      if (g) {
        const k = keysHeld.current;
        const tch = touchHeld.current;
        const left = k.left || tch.left || padHold.left;
        const right = k.right || tch.right || padHold.right;
        const dir = left === right ? 0 : left ? -1 : 1;
        const events = g.frame(dt, { dir, jumpHeld: k.jump || tch.jump || padHold.jump, jumpPressed: jumpPress.current });
        jumpPress.current = false;
        if (events.length) onEvents(events);
        if (now - hudAt > 100 || events.length) {
          hudAt = now;
          setHud({
            time: g.seconds,
            coins: g.coinCount,
            total: g.coinTotal,
            deaths: g.deaths,
            finished: g.status === "finished",
            jumps: g.body.jumps,
          });
        }
      }
      if (canvas && ctx) {
        const w = lv.w * TILE;
        const h = lv.h * TILE;
        const level = g ? g.level : lv;
        if (canvas.width !== level.w * TILE || canvas.height !== level.h * TILE) {
          canvas.width = level.w * TILE;
          canvas.height = level.h * TILE;
        }
        ctx.imageSmoothingEnabled = false;
        drawLevel(ctx, level, {
          grid: !g && storeRef.current.settings.grid,
          colors,
          coins: g?.coins,
          cursor: g ? null : cursorRef.current,
          showStart: !g,
          time: now / 1000,
          motion,
        });
        if (g) {
          const pos = g.renderPos();
          const frames = storeRef.current.settings.sprite ? spriteFramesRef.current : null;
          const running = g.body.onGround && Math.abs(g.body.vx) > 1;
          const sp = frames && sprite.ok ? frames[spriteFrame(sprite.sprite, g.runTicks, running)] : null;
          drawPlayer(ctx, pos.x, pos.y, g.body.facing, colors, sp ?? null);
          if (g.status === "finished" && motion) {
            ctx.fillStyle = "rgba(143,206,171,0.18)";
            ctx.fillRect(0, 0, w, h);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("gamepaddisconnected", onDisconnect);
    };
  }, [sprite]); // eslint-disable-line react-hooks/exhaustive-deps

  function tileFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const lv = levelRef.current;
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * lv.w);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * lv.h);
    if (x < 0 || y < 0 || x >= lv.w || y >= lv.h) return null;
    return { x, y };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (modeRef.current !== "edit") return;
    const at = tileFromEvent(event);
    if (!at) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const erase = event.button === 2 || tool === "empty";
    const before = levelRef.current;
    strokeRef.current = { before, changed: false, erase };
    setCursor(at);
    const next = paintAt(at.x, at.y, erase);
    if (next) {
      strokeRef.current.changed = true;
      levelRef.current = next;
      setLevel(next);
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = strokeRef.current;
    if (!stroke || modeRef.current !== "edit") return;
    const at = tileFromEvent(event);
    if (!at) return;
    const next = paintAt(at.x, at.y, stroke.erase);
    if (next) {
      stroke.changed = true;
      levelRef.current = next;
      setLevel(next);
    }
  }

  function onPointerUp() {
    const stroke = strokeRef.current;
    strokeRef.current = null;
    if (stroke?.changed) {
      setUndoStack((stack) => [...stack.slice(-(HISTORY_MAX - 1)), stroke.before]);
      setRedoStack([]);
      setShareUrl("");
    }
  }

  function applySize() {
    const w = Number(sizeW);
    const h = Number(sizeH);
    if (!validSize(w, h)) {
      setError(text.linkErrors.size);
      return;
    }
    if (w === level.w && h === level.h) return;
    commit(resizeLevel(level, w, h), level);
    setCursor({ x: Math.min(cursor.x, w - 1), y: Math.min(cursor.y, h - 1) });
    persist({ ...store, settings: { ...store.settings, w, h } });
    setError("");
  }

  function share() {
    const hash = encodeLevel(level);
    const url = `${location.origin}${location.pathname}#${hash}`;
    setShareUrl(url);
    history.replaceState(null, "", `#${hash}`);
    const notice = reach && reach.complete && !reach.reachable ? ` ${text.reachShareNotice}` : "";
    const done = (ok: boolean) => setStatus(`${ok ? text.shareCopied : text.shareManual}${notice}`);
    try {
      navigator.clipboard?.writeText(url).then(
        () => done(true),
        () => done(false),
      ) ?? done(false);
    } catch {
      done(false);
    }
  }

  function saveCurrent() {
    const result = saveLevel(store, level, encodeLevel(level), new Date());
    if (result.status === "full") {
      setError(text.savedFull);
      return;
    }
    persist(result.store);
    setStatus(result.status === "updated" ? text.savedUpdated : text.saved);
  }

  function setTitle(value: string) {
    setLevel({ ...level, title: cleanTitle(value) });
    setShareUrl("");
  }

  const playing = mode === "play";
  const title = level.title || text.untitled;
  const bestHere = store.best[levelHash(level)];
  const cursorTile = tileAt(level, cursor.x, cursor.y);
  const tileName = text.tools[TOOLS[cursorTile] ?? "empty"];
  const reachText = problems.length
    ? ""
    : !reach
      ? text.reachChecking
      : !reach.complete
        ? text.reachUnknown
        : reach.reachable
          ? text.reachOk
          : text.reachBad;
  const reachBad = Boolean(reach && reach.complete && !reach.reachable);

  return (
    <div className="flex flex-col gap-4" data-testid="level-editor" data-mode={mode}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={text.modeGroup}>
        <button type="button" className="chip" aria-pressed={!playing} data-testid="mode-edit" onClick={() => playing && stopPlay()}>
          {text.modeEdit}
        </button>
        <button type="button" className="chip" aria-pressed={playing} data-testid="mode-play" onClick={() => !playing && startPlay()}>
          {text.modePlay}
        </button>
        {playing ? (
          <>
            <button type="button" className="btn btn-ghost" data-testid="retry" onClick={retry}>
              {text.retry}
            </button>
            <button type="button" className="btn btn-ghost" data-testid="back" onClick={stopPlay}>
              {text.backToEditor}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" data-testid="undo" disabled={!undoStack.length} onClick={undo}>
              {text.undo}
            </button>
            <button type="button" className="btn btn-ghost" data-testid="redo" disabled={!redoStack.length} onClick={redo}>
              {text.redo}
            </button>
          </>
        )}
      </div>

      {!playing ? (
        <fieldset className="flex flex-wrap gap-2" data-testid="tools">
          <legend className="sr-only">{text.toolsLegend}</legend>
          {TOOLS.map((name, i) => (
            <button
              key={name}
              type="button"
              className="chip"
              aria-pressed={tool === name}
              data-testid={`tool-${name}`}
              title={fill(text.toolHint, { n: i + 1 })}
              onClick={() => chooseTool(name)}
            >
              <span aria-hidden="true" className={`tool-swatch tool-${name}`} />
              {text.tools[name]}
              <span className="sr-only"> ({fill(text.toolHint, { n: i + 1 })})</span>
            </button>
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            data-testid="fill-row"
            onClick={() => {
              const next = cloneLevel(level);
              const t = TOOL_TILES[tool];
              if (fillRow(next, cursor.y, t === 4 ? TILE_SOLID : t)) commit(next, level);
            }}
          >
            {text.fillRow}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            data-testid="clear"
            onClick={() => commit(emptyLevel(level.w, level.h, level.title), level)}
          >
            {text.clearLevel}
          </button>
        </fieldset>
      ) : (
        <div className="hud flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm" data-testid="hud" data-jumps={hud.jumps} data-finished={hud.finished}>
          <span>
            {text.hudTime}: <span data-testid="hud-time">{formatTime(hud.time)}</span>
          </span>
          <span>
            {text.hudCoins}: <span data-testid="hud-coins">{hud.coins}</span>/{hud.total}
          </span>
          <span>
            {text.hudDeaths}: <span data-testid="hud-deaths">{hud.deaths}</span>
          </span>
          {bestHere ? <span>{fill(text.bestLabel, { time: formatTime(bestHere.ms / 1000) })}</span> : null}
        </div>
      )}

      <div ref={playAreaRef} className="flex flex-col gap-3">
        <div className="stage panel rounded-xl p-2">
          <canvas
            ref={canvasRef}
            className="level-canvas"
            data-testid="canvas"
            tabIndex={0}
            role="img"
            aria-label={
              playing
                ? fill(text.canvasPlayLabel, { title })
                : fill(text.canvasLabel, { title, w: level.w, h: level.h, x: cursor.x + 1, y: cursor.y + 1, tile: tileName })
            }
            width={level.w * TILE}
            height={level.h * TILE}
            style={{ aspectRatio: `${level.w} / ${level.h}`, maxWidth: `min(${level.w * TILE * 3}px, calc(78vh * ${level.w} / ${level.h}))` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(event) => event.preventDefault()}
          />
        </div>

        {playing && touch ? (
          <div className="touch-pad flex justify-between gap-3" data-testid="touch-controls">
            <div className="flex gap-3">
              {(["left", "right"] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  className="touch-btn"
                  aria-label={dir === "left" ? text.touchLeft : text.touchRight}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    touchHeld.current[dir] = true;
                  }}
                  onPointerUp={() => (touchHeld.current[dir] = false)}
                  onPointerLeave={() => (touchHeld.current[dir] = false)}
                  onPointerCancel={() => (touchHeld.current[dir] = false)}
                >
                  {dir === "left" ? "◀" : "▶"}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="touch-btn touch-jump"
              aria-label={text.touchJump}
              onPointerDown={(event) => {
                event.preventDefault();
                touchHeld.current.jump = true;
                jumpPress.current = true;
              }}
              onPointerUp={() => (touchHeld.current.jump = false)}
              onPointerLeave={() => (touchHeld.current.jump = false)}
              onPointerCancel={() => (touchHeld.current.jump = false)}
            >
              ▲
            </button>
          </div>
        ) : null}
      </div>

      <p aria-live="polite" role="status" data-testid="status" className="min-h-6 text-sm text-fg">
        {status}
      </p>
      {error ? (
        <p role="alert" data-testid="error" className="notice-bad rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}
      {problems.length ? (
        <ul data-testid="problems" className="notice-bad rounded-lg px-3 py-2 text-sm">
          {problems.map((p) => (
            <li key={p}>{text.problems[p]}</li>
          ))}
        </ul>
      ) : (
        <p
          data-testid="reach"
          data-reach={reach ? (reach.complete ? String(reach.reachable) : "unknown") : "pending"}
          className={`rounded-lg px-3 py-2 text-sm ${reachBad ? "notice-bad" : "text-muted"}`}
        >
          {reachText}
        </p>
      )}

      {!playing ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel flex flex-col gap-3 rounded-xl px-4 py-4">
            <label className="flex flex-col gap-1 text-sm">
              {text.titleLabel}
              <input
                className="field"
                type="text"
                maxLength={40}
                value={level.title}
                data-testid="title"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <fieldset className="flex flex-wrap items-end gap-2">
              <legend className="mb-1 text-sm">{text.sizeLegend}</legend>
              <label className="flex flex-col gap-1 text-sm">
                {text.widthLabel}
                <input
                  className="field w-24"
                  type="number"
                  min={MIN_W}
                  max={MAX_W}
                  value={sizeW}
                  data-testid="size-w"
                  onChange={(event) => setSizeW(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {text.heightLabel}
                <input
                  className="field w-24"
                  type="number"
                  min={MIN_H}
                  max={MAX_H}
                  value={sizeH}
                  data-testid="size-h"
                  onChange={(event) => setSizeH(event.target.value)}
                />
              </label>
              <button type="button" className="btn btn-ghost" data-testid="apply-size" onClick={applySize}>
                {text.applySize}
              </button>
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={store.settings.grid}
                onChange={(event) => persist({ ...store, settings: { ...store.settings, grid: event.target.checked } })}
              />
              {text.gridToggle}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="sprite-toggle"
                checked={store.settings.sprite}
                onChange={(event) => {
                  setSprite(readSprite(storage));
                  persist({ ...store, settings: { ...store.settings, sprite: event.target.checked } });
                }}
              />
              {text.spriteToggle}
            </label>
            <p className="text-sm text-muted" data-testid="sprite-status" data-sprite={useSprite ? "on" : "off"}>
              {sprite.ok
                ? fill(text.spriteOk, { size: sprite.sprite.size, frames: sprite.sprite.frames.length })
                : sprite.reason === "missing"
                  ? text.spriteMissing
                  : sprite.reason === "corrupt"
                    ? text.spriteCorrupt
                    : text.spriteBlocked}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" data-testid="share" disabled={problems.length > 0} onClick={share}>
                {text.share}
              </button>
              <button type="button" className="btn btn-ghost" data-testid="save" disabled={problems.length > 0} onClick={saveCurrent}>
                {text.save}
              </button>
            </div>
            {shareUrl ? (
              <label className="flex flex-col gap-1 text-sm">
                {text.shareLabel}
                <input
                  className="field font-mono text-xs"
                  readOnly
                  value={shareUrl}
                  data-testid="share-url"
                  onFocus={(event) => event.target.select()}
                />
              </label>
            ) : null}
            <p className="text-xs text-subtle">{text.reachInfo}</p>
          </section>
          <section className="panel flex flex-col gap-3 rounded-xl px-4 py-4">
            <h3 className="font-display text-lg font-semibold">{text.samplesHeading}</h3>
            <ul className="flex flex-col gap-2" data-testid="samples">
              {samples.map((sample) => {
                const lv = sampleLevel(sample, lang);
                const best = store.best[levelHash(lv)];
                return (
                  <li key={sample.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {sample[lang]}
                      {best ? <span className="ml-2 text-sm text-subtle">{fill(text.bestLabel, { time: formatTime(best.ms / 1000) })}</span> : null}
                    </span>
                    <button type="button" className="btn btn-ghost" data-testid={`sample-${sample.id}`} onClick={() => loadLevel(lv)}>
                      {text.load}
                    </button>
                  </li>
                );
              })}
            </ul>
            <h3 className="font-display text-lg font-semibold">{text.savedHeading}</h3>
            {store.levels.length ? (
              <ul className="flex flex-col gap-2" data-testid="saved">
                {store.levels.map((item) => {
                  const best = store.best[item.id];
                  return (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {item.title || text.untitled}
                        {best ? <span className="ml-2 text-sm text-subtle">{fill(text.bestLabel, { time: formatTime(best.ms / 1000) })}</span> : null}
                      </span>
                      <span className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            const result = decodeLevel(item.link);
                            if (result.ok) loadLevel(result.level);
                          }}
                        >
                          {text.load}
                        </button>
                        <button type="button" className="btn btn-bad" onClick={() => persist(deleteLevel(store, item.id))}>
                          {text.remove}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">{text.savedEmpty}</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
