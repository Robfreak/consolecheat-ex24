// Canvas drawing. The canvas has 16 px per tile and is scaled up by CSS with
// `image-rendering: pixelated`, so tiles stay crisp at any size.

import { TILE_COIN, TILE_GOAL, TILE_SOLID, TILE_SPIKE, TILE_START, type Level } from "./level.ts";
import { PLAYER_H, PLAYER_W, TILE } from "./physics.ts";
import type { SpriteFrames } from "./sprite.ts";

export type Palette = {
  sky: string;
  grid: string;
  solid: string;
  solidEdge: string;
  spike: string;
  coin: string;
  goal: string;
  start: string;
  player: string;
  playerEye: string;
  cursor: string;
};

export function palette(theme: "light" | "dark"): Palette {
  return theme === "light"
    ? {
        sky: "#e8eef6",
        grid: "#c9d3e0",
        solid: "#5b6476",
        solidEdge: "#3b4252",
        spike: "#a33b3b",
        coin: "#c58b00",
        goal: "#1d6b43",
        start: "#2c4d73",
        player: "#0070d1",
        playerEye: "#ffffff",
        cursor: "#a33b3b",
      }
    : {
        sky: "#0d1220",
        grid: "#1e2738",
        solid: "#3a4560",
        solidEdge: "#5a6b8f",
        spike: "#e09898",
        coin: "#f2c94c",
        goal: "#8fceab",
        start: "#7eb6ff",
        player: "#7eb6ff",
        playerEye: "#07090e",
        cursor: "#f2c94c",
      };
}

export type DrawOptions = {
  grid: boolean;
  colors: Palette;
  coins?: Uint8Array;
  cursor?: { x: number; y: number } | null;
  showStart: boolean;
  time: number;
  motion: boolean;
};

export function drawLevel(ctx: CanvasRenderingContext2D, level: Level, opts: DrawOptions) {
  const { colors } = opts;
  ctx.fillStyle = colors.sky;
  ctx.fillRect(0, 0, level.w * TILE, level.h * TILE);
  if (opts.grid) {
    ctx.fillStyle = colors.grid;
    for (let x = 1; x < level.w; x++) ctx.fillRect(x * TILE, 0, 1, level.h * TILE);
    for (let y = 1; y < level.h; y++) ctx.fillRect(0, y * TILE, level.w * TILE, 1);
  }
  const bob = opts.motion ? Math.round(Math.sin(opts.time * 4) * 1) : 0;
  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      const i = y * level.w + x;
      const t = level.tiles[i];
      const px = x * TILE;
      const py = y * TILE;
      if (t === TILE_SOLID) {
        ctx.fillStyle = colors.solidEdge;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = colors.solid;
        ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      } else if (t === TILE_SPIKE) {
        ctx.fillStyle = colors.spike;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(px + 1 + k * 5, py + TILE);
          ctx.lineTo(px + 3.5 + k * 5, py + 7);
          ctx.lineTo(px + 6 + k * 5, py + TILE);
          ctx.closePath();
          ctx.fill();
        }
      } else if (t === TILE_COIN) {
        if (opts.coins?.[i]) continue;
        ctx.fillStyle = colors.coin;
        ctx.fillRect(px + 5, py + 3 + bob, 6, 10);
        ctx.fillRect(px + 4, py + 5 + bob, 8, 6);
      } else if (t === TILE_GOAL) {
        ctx.fillStyle = colors.solidEdge;
        ctx.fillRect(px + 3, py + 1, 2, 15);
        ctx.fillStyle = colors.goal;
        ctx.fillRect(px + 5, py + 2, 9, 6);
      } else if (t === TILE_START && opts.showStart) {
        ctx.strokeStyle = colors.start;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
        ctx.fillStyle = colors.start;
        ctx.fillRect(px + 6, py + 6, 4, 4);
      }
    }
  }
  if (opts.cursor) {
    ctx.strokeStyle = colors.cursor;
    ctx.lineWidth = 2;
    ctx.strokeRect(opts.cursor.x * TILE + 1, opts.cursor.y * TILE + 1, TILE - 2, TILE - 2);
  }
}

/** Turns decoded sprite frames into canvases once, for drawImage. */
export function spriteCanvases(sprite: SpriteFrames): HTMLCanvasElement[] {
  return sprite.frames.map((pixels) => {
    const canvas = document.createElement("canvas");
    canvas.width = sprite.size;
    canvas.height = sprite.size;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), sprite.size, sprite.size), 0, 0);
    return canvas;
  });
}

/** The player: the sprite frame drawn in a 16×16 box over the fixed 12×14 hitbox, or the default character. */
export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, facing: -1 | 1, colors: Palette, frame: HTMLCanvasElement | null) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (frame) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const bx = px - (TILE - PLAYER_W) / 2;
    const by = py + PLAYER_H - TILE;
    if (facing < 0) {
      ctx.translate(bx + TILE, by);
      ctx.scale(-1, 1);
      ctx.drawImage(frame, 0, 0, TILE, TILE);
    } else ctx.drawImage(frame, bx, by, TILE, TILE);
    ctx.restore();
    return;
  }
  ctx.fillStyle = colors.player;
  ctx.fillRect(px, py + 2, PLAYER_W, PLAYER_H - 2);
  ctx.fillRect(px + 2, py, PLAYER_W - 4, 2);
  ctx.fillStyle = colors.playerEye;
  const eye = facing > 0 ? px + 7 : px + 2;
  ctx.fillRect(eye, py + 4, 3, 3);
}
