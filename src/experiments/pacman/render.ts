// Canvas drawing for the Pac-Man board. Pure: drawScene reads a PacmanState and
// draws a single frame. No simulation logic lives here.

import {
  AI_DANGER_COLOR,
  AI_PATH_COLOR,
  COLS,
  DEATH_DURATION,
  DIR_VEC,
  FRUIT_COLOR,
  GHOST_COLOR,
  POPUP_DURATION,
  ROWS,
  WORMHOLE_COLOR,
} from "./constants";
import { PELLET_KINDS, effectiveKind } from "./pellets/registry";
import { bfsPath } from "./bfs";
import { getActiveMaze } from "./maze";
import { tileOf } from "./targeting";
import { ghostMode } from "./simulation";
import type { Direction, Ghost, GhostId, GhostRole, PacmanState, Tile } from "./types";

/** Single-glyph role badge for coordinated mode (drawn over each ghost). */
const ROLE_LETTER: Record<GhostRole, string> = {
  chaser: "C",
  ambusher: "A",
  cutter: "F",
  lurker: "L",
};

export interface Palette {
  bg: string;
  wall: string;
  gate: string;
  pellet: string;
  text: string;
}

const PACMAN_COLOR = "#ffd24a";
const FRIGHT_BODY = "#3b4fd6";
const FRIGHT_FLASH = "#e8ecff";
const EYE_WHITE = "#ffffff";
const EYE_PUPIL = "#1b2152";

export function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    bg: v("--bg", "#0b0e16"),
    wall: v("--accent2", "#7c5cff"),
    gate: "#ff9ed6",
    pellet: v("--text-dim", "#9aa3b2"),
    text: v("--text", "#e7ecf3"),
  };
}

export interface DrawOpts {
  palette: Palette;
  tile: number;
  time: number;
  reduced: boolean;
  showOverlay: boolean;
  showPaths: boolean;
  /** Draw the AI driver's ghost danger heatmap. */
  showDanger: boolean;
  explainId: GhostId | null;
}

const DIR_ANGLE: Record<Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

function center(v: number, tile: number): number {
  return (v + 0.5) * tile;
}

function drawMaze(ctx: CanvasRenderingContext2D, p: Palette, tile: number) {
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, COLS * tile, ROWS * tile);

  // Walls: filled rounded cells with a translucent fill and crisp edge.
  ctx.strokeStyle = p.wall;
  ctx.lineWidth = Math.max(1, tile * 0.08);
  const grid = getActiveMaze();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ch = grid[row][col];
      if (ch === "#") {
        ctx.fillStyle = p.wall;
        ctx.globalAlpha = 0.16;
        roundRect(ctx, col * tile + 1, row * tile + 1, tile - 2, tile - 2, tile * 0.28);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (ch === "-") {
        ctx.fillStyle = p.gate;
        ctx.fillRect(col * tile, row * tile + tile * 0.42, tile, tile * 0.16);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  state: PacmanState,
  tile: number,
  time: number,
  reduced: boolean,
) {
  const pulse = reduced ? 1 : 0.75 + 0.25 * Math.sin(time * 6);
  for (const [key] of state.board) {
    const kind = effectiveKind(state, key);
    if (!kind) continue;
    const [col, row] = key.split(",").map(Number);
    const cx = center(col, tile);
    const cy = center(row, tile);
    const color = PELLET_KINDS[kind].color;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    switch (kind) {
      case "dot":
        ctx.beginPath();
        ctx.arc(cx, cy, tile * 0.09, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "energizer":
        ctx.beginPath();
        ctx.arc(cx, cy, tile * 0.26 * pulse, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "decoy": {
        // Hollow ring (a "fake Pac") + centre pip.
        ctx.lineWidth = Math.max(1.5, tile * 0.08);
        ctx.beginPath();
        ctx.arc(cx, cy, tile * 0.24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, tile * 0.07, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "freeze": {
        const s = tile * 0.22;
        ctx.beginPath();
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx + s, cy);
        ctx.lineTo(cx, cy + s);
        ctx.lineTo(cx - s, cy);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "speed": {
        const s = tile * 0.26;
        ctx.beginPath();
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx + s, cy + s);
        ctx.lineTo(cx - s, cy + s);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "trap": {
        const s = tile * 0.22;
        ctx.lineWidth = Math.max(1.5, tile * 0.09);
        ctx.beginPath();
        ctx.moveTo(cx - s, cy - s);
        ctx.lineTo(cx + s, cy + s);
        ctx.moveTo(cx + s, cy - s);
        ctx.lineTo(cx - s, cy + s);
        ctx.stroke();
        break;
      }
    }
  }
}

function drawWormholes(
  ctx: CanvasRenderingContext2D,
  state: PacmanState,
  tile: number,
  time: number,
  reduced: boolean,
) {
  if (!state.enabledPellets.teleport) return;
  const spin = reduced ? 0 : time * 2;
  ctx.strokeStyle = WORMHOLE_COLOR;
  for (const [key] of state.wormholes) {
    const [col, row] = key.split(",").map(Number);
    const cx = center(col, tile);
    const cy = center(row, tile);
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = Math.max(1.5, tile * 0.07);
    ctx.beginPath();
    ctx.arc(cx, cy, tile * 0.34, spin, spin + Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, tile * 0.18, -spin, -spin + Math.PI * 1.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawFruit(ctx: CanvasRenderingContext2D, state: PacmanState, tile: number) {
  if (!state.fruit) return;
  const cx = center(state.fruit.tile.col, tile);
  const cy = center(state.fruit.tile.row, tile);
  ctx.fillStyle = FRUIT_COLOR;
  ctx.beginPath();
  ctx.arc(cx, cy + tile * 0.05, tile * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#76e36a";
  ctx.lineWidth = Math.max(1, tile * 0.06);
  ctx.beginPath();
  ctx.moveTo(cx, cy - tile * 0.18);
  ctx.lineTo(cx + tile * 0.16, cy - tile * 0.32);
  ctx.stroke();
}

function drawPhantom(ctx: CanvasRenderingContext2D, state: PacmanState, tile: number) {
  if (!state.decoy) return;
  const cx = center(state.decoy.x, tile);
  const cy = center(state.decoy.y, tile);
  const r = tile * 0.46;
  const base = DIR_ANGLE[state.decoy.dir];
  const m = 0.22 * Math.PI;
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = PELLET_KINDS.decoy.color;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, base + m, base + Math.PI * 2 - m);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPac(
  ctx: CanvasRenderingContext2D,
  state: PacmanState,
  tile: number,
  time: number,
  reduced: boolean,
) {
  const cx = center(state.pac.x, tile);
  const cy = center(state.pac.y, tile);
  let r = tile * 0.46;
  const base = DIR_ANGLE[state.pac.dir];
  let m: number;
  if (state.status === "dying") {
    // Iconic death: the mouth opens ever wider until Pac-Man closes to nothing.
    const p = Math.min(1, state.deathTimer / DEATH_DURATION);
    if (p >= 0.995) return;
    m = 0.18 * Math.PI + p * (Math.PI - 0.18 * Math.PI);
    r *= 1 - 0.18 * p;
  } else {
    m = reduced ? 0.18 * Math.PI : (0.18 + 0.16 * (0.5 + 0.5 * Math.sin(time * 14))) * Math.PI;
  }
  ctx.fillStyle = PACMAN_COLOR;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, base + m, base + Math.PI * 2 - m);
  ctx.closePath();
  ctx.fill();
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  g: Ghost,
  mode: string,
  tile: number,
  time: number,
  reduced: boolean,
  dim: boolean,
) {
  const cx = center(g.x, tile);
  const cy = center(g.y, tile);
  const r = tile * 0.44;
  const eyesOnly = mode === "eaten";
  ctx.globalAlpha = dim ? 0.32 : 1;

  if (!eyesOnly) {
    let body = GHOST_COLOR[g.id];
    if (mode === "frightened") {
      const flashing = !reduced && Math.sin(time * 18) > 0;
      body = flashing ? FRIGHT_FLASH : FRIGHT_BODY;
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.1, r, Math.PI, 0);
    ctx.lineTo(cx + r, cy + r * 0.7);
    // Wavy skirt zig-zagging back to the left edge. The phase flips a few times
    // a second so the feet shuffle, the way the arcade sprite animates.
    const phase = reduced ? 0 : Math.floor(time * 9) % 2;
    const feet = 3;
    for (let i = 1; i <= feet; i++) {
      const x = cx + r - (i * 2 * r) / feet;
      const y = (i + phase) % 2 === 1 ? cy + r * 0.42 : cy + r * 0.7;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Eyes (always drawn; frightened ghosts get a simple face instead).
  if (mode === "frightened" && !eyesOnly) {
    ctx.fillStyle = EYE_PUPIL;
    ctx.beginPath();
    ctx.arc(cx - r * 0.34, cy - r * 0.12, r * 0.12, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.34, cy - r * 0.12, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const { dx, dy } = DIR_VEC[g.dir];
    for (const sx of [-1, 1]) {
      const ex = cx + sx * r * 0.34;
      const ey = cy - r * 0.12;
      ctx.fillStyle = EYE_WHITE;
      ctx.beginPath();
      ctx.ellipse(ex, ey, r * 0.2, r * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = EYE_PUPIL;
      ctx.beginPath();
      ctx.arc(ex + dx * r * 0.09, ey + dy * r * 0.11, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawTargetMarker(ctx: CanvasRenderingContext2D, t: Tile, color: string, tile: number) {
  const cx = center(t.col, tile);
  const cy = center(t.row, tile);
  const s = tile * 0.32;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, tile * 0.1);
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(cx - s, cy - s);
  ctx.lineTo(cx + s, cy + s);
  ctx.moveTo(cx + s, cy - s);
  ctx.lineTo(cx - s, cy + s);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPath(ctx: CanvasRenderingContext2D, path: Tile[], color: string, tile: number) {
  if (path.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, tile * 0.12);
  ctx.globalAlpha = 0.4;
  ctx.setLineDash([tile * 0.25, tile * 0.3]);
  ctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const px = center(path[i].col, tile);
    const py = center(path[i].row, tile);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function drawOverlay(ctx: CanvasRenderingContext2D, state: PacmanState, opts: DrawOpts) {
  const { tile, explainId } = opts;
  for (const g of state.ghosts) {
    if (!state.enabled[g.id]) continue;
    if (g.pen !== "active") continue;
    const em = ghostMode(state, g);
    if (em === "frightened" || em === "eaten") continue;
    if (explainId && g.id !== explainId) continue;
    const color = GHOST_COLOR[g.id];

    if (opts.showPaths) {
      const path = bfsPath(tileOf(g), g.target);
      if (path) drawPath(ctx, path, color, tile);
    }

    // Clamp the target onto the board: scatter "home corners" live off-map, so
    // the crosshair is pinned to the nearest edge tile rather than drawn beyond
    // the maze border.
    const clamped: Tile = {
      col: Math.max(0, Math.min(COLS - 1, g.target.col)),
      row: Math.max(0, Math.min(ROWS - 1, g.target.row)),
    };
    const gx = center(g.x, tile);
    const gy = center(g.y, tile);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, tile * 0.05);
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(center(clamped.col, tile), center(clamped.row, tile));
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawTargetMarker(ctx, clamped, color, tile);

    // Coordinated mode: stamp the ghost's assigned role above it (C/A/F/L).
    if (g.role) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.95;
      ctx.font = `700 ${Math.max(8, tile * 0.55)}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ROLE_LETTER[g.role], gx, gy - tile * 0.85);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = 1;
    }

    if (explainId === g.id) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, tile * 0.12);
      ctx.beginPath();
      ctx.arc(gx, gy, tile * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawDanger(ctx: CanvasRenderingContext2D, danger: Float32Array, tile: number) {
  for (let id = 0; id < danger.length; id++) {
    const v = danger[id];
    if (v < 0.03) continue;
    const col = id % COLS;
    const row = Math.floor(id / COLS);
    ctx.fillStyle = AI_DANGER_COLOR;
    ctx.globalAlpha = Math.min(0.5, v * 0.5);
    ctx.fillRect(col * tile, row * tile, tile, tile);
  }
  ctx.globalAlpha = 1;
}

function drawPacPlan(
  ctx: CanvasRenderingContext2D,
  state: PacmanState,
  tile: number,
) {
  const plan = state.pacPlan;
  if (!plan) return;

  // Monte-Carlo rollout fan: a faint spray of sampled playout paths. Breaks the
  // stroke across the tunnel wrap so it does not draw a line across the board.
  if (plan.rollouts && plan.rollouts.length) {
    ctx.strokeStyle = AI_PATH_COLOR;
    ctx.lineWidth = Math.max(1, tile * 0.05);
    ctx.globalAlpha = 0.13;
    for (const rp of plan.rollouts) {
      ctx.beginPath();
      let penDown = false;
      for (let i = 0; i < rp.length; i++) {
        const px = center(rp[i].col, tile);
        const py = center(rp[i].row, tile);
        const wrap =
          i > 0 &&
          (Math.abs(rp[i].col - rp[i - 1].col) > 1 || Math.abs(rp[i].row - rp[i - 1].row) > 1);
        if (!penDown || wrap) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
        penDown = true;
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Intended route. Breaks the stroke wherever consecutive tiles are not
  // adjacent - a wormhole teleport or the side-tunnel wrap - so the path resumes
  // at the exit instead of slashing a line across the board.
  if (plan.path.length >= 2) {
    ctx.strokeStyle = AI_PATH_COLOR;
    ctx.lineWidth = Math.max(1, tile * 0.13);
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([tile * 0.3, tile * 0.25]);
    ctx.beginPath();
    plan.path.forEach((t, i) => {
      const px = center(t.col, tile);
      const py = center(t.row, tile);
      const jump =
        i > 0 &&
        (Math.abs(t.col - plan.path[i - 1].col) > 1 || Math.abs(t.row - plan.path[i - 1].row) > 1);
      if (i === 0 || jump) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Target marker (diamond).
  if (plan.target) {
    const cx = center(plan.target.col, tile);
    const cy = center(plan.target.row, tile);
    const s = tile * 0.3;
    ctx.fillStyle = AI_PATH_COLOR;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s, cy);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Search agent: weight each candidate move by its backed-up score.
  if (plan.candidates && plan.candidates.length) {
    const scores = plan.candidates.map((c) => c.score);
    const lo = Math.min(...scores);
    const hi = Math.max(...scores);
    const pcx = center(state.pac.x, tile);
    const pcy = center(state.pac.y, tile);
    for (const c of plan.candidates) {
      const norm = hi > lo ? (c.score - lo) / (hi - lo) : 1;
      const v = DIR_VEC[c.dir];
      ctx.strokeStyle = AI_PATH_COLOR;
      ctx.globalAlpha = 0.25 + 0.6 * norm;
      ctx.lineWidth = Math.max(1, tile * 0.18 * (0.4 + 0.6 * norm));
      ctx.beginPath();
      ctx.moveTo(pcx, pcy);
      ctx.lineTo(pcx + v.dx * tile * 0.85, pcy + v.dy * tile * 0.85);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** Floating "+N"/"-N" score numbers: pop in, drift up, fade out. */
function drawPopups(
  ctx: CanvasRenderingContext2D,
  state: PacmanState,
  tile: number,
  reduced: boolean,
) {
  if (!state.popups.length) return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const pop of state.popups) {
    if (pop.time >= POPUP_DURATION) continue; // skip any stale (e.g. paused) popup
    const k = Math.min(1, pop.time / POPUP_DURATION);
    const rise = reduced ? tile * 0.3 : tile * (0.25 + 1.0 * k);
    const alpha = k < 0.65 ? 1 : Math.max(0, 1 - (k - 0.65) / 0.35);
    const scale = reduced ? 1 : k < 0.16 ? 0.55 + 0.45 * (k / 0.16) : 1; // quick pop-in
    const positive = pop.amount >= 0;
    const text = pop.label ?? (positive ? "+" : "") + pop.amount;
    const cx = center(pop.col, tile);
    const cy = center(pop.row, tile) - rise;
    // Bigger scores read larger; a stream of "+10" dots stays small and quiet.
    // A labelled popup (e.g. "1UP") uses a fixed prominent size.
    const sizeFactor = pop.label
      ? 0.74
      : Math.min(0.86, 0.4 + 0.13 * Math.log10(Math.abs(pop.amount) + 1));
    ctx.globalAlpha = alpha;
    ctx.font = `800 ${tile * sizeFactor * scale}px "JetBrains Mono", monospace`;
    ctx.lineWidth = Math.max(1.5, tile * 0.14);
    ctx.strokeStyle = "rgba(7,9,16,0.9)";
    ctx.strokeText(text, cx, cy);
    ctx.fillStyle = pop.label ? "#76e36a" : positive ? "#ffe24a" : "#ff6b76";
    ctx.fillText(text, cx, cy);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

export function drawScene(ctx: CanvasRenderingContext2D, state: PacmanState, opts: DrawOpts) {
  const { palette, tile, time, reduced, explainId } = opts;
  const aiActive = state.pacController !== "human";
  drawMaze(ctx, palette, tile);

  // During the death animation the ghosts vanish (arcade behaviour) and only
  // Pac-Man's closing animation plays.
  const dying = state.status === "dying";

  if (aiActive && opts.showDanger && state.pacPlan?.danger && !dying) {
    drawDanger(ctx, state.pacPlan.danger, tile);
  }

  drawBoard(ctx, state, tile, time, reduced);
  drawWormholes(ctx, state, tile, time, reduced);
  drawFruit(ctx, state, tile);

  if (opts.showOverlay && !dying) drawOverlay(ctx, state, opts);
  if (aiActive && !dying) drawPacPlan(ctx, state, tile);

  if (!dying) drawPhantom(ctx, state, tile);
  drawPac(ctx, state, tile, time, reduced);
  if (!dying) {
    for (const g of state.ghosts) {
      if (!state.enabled[g.id]) continue;
      const em = ghostMode(state, g);
      const dim = explainId != null && g.id !== explainId && g.pen === "active";
      drawGhost(ctx, g, em, tile, time, reduced, dim);
    }
  }

  // Subtle full-board tint while a freeze or speed effect is active.
  if (state.freezeTime > 0) {
    ctx.fillStyle = "#8fd6ff";
    ctx.globalAlpha = 0.1;
    ctx.fillRect(0, 0, COLS * tile, ROWS * tile);
    ctx.globalAlpha = 1;
  } else if (state.speedTime > 0) {
    ctx.fillStyle = "#76e36a";
    ctx.globalAlpha = 0.07;
    ctx.fillRect(0, 0, COLS * tile, ROWS * tile);
    ctx.globalAlpha = 1;
  }

  // Floating score numbers sit on top of everything.
  drawPopups(ctx, state, tile, reduced);
}
