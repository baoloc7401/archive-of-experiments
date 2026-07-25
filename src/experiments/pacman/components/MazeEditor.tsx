import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Button, Panel } from "@/components/ui";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import { COLS, FRUIT_COLOR, ROWS, TILE_PX, WORMHOLE_COLOR } from "../constants";
import { tileKey } from "../maze";
import { readPalette } from "../render";
import { CHAR_KIND, PELLET_KINDS, type SpecialKind } from "../pellets/registry";
import { generateMaze } from "../mazes/generate";
import { decodeMaze, encodeMaze } from "../mazes/serialize";
import {
  applyClassicContent,
  applyStructure,
  blankGrid,
  isLocked,
  setCell,
  stripContent,
  type MazeGrid,
} from "../mazes/structure";
import { validateMaze } from "../mazes/validate";
import {
  BUILTIN_MAZES,
  deleteCustomMaze,
  loadCustomMazes,
  saveCustomMaze,
  type MazeEntry,
} from "../mazes/registry";

type Brush = string;
const TERRAIN: { ch: string; key: string }[] = [
  { ch: "#", key: "wall" },
  { ch: ".", key: "dot" },
  { ch: " ", key: "empty" },
];
const CONTENT: { ch: string; kind: SpecialKind; color: string }[] = [
  { ch: "o", kind: "energizer", color: PELLET_KINDS.energizer.color },
  { ch: "D", kind: "decoy", color: PELLET_KINDS.decoy.color },
  { ch: "F", kind: "freeze", color: PELLET_KINDS.freeze.color },
  { ch: "S", kind: "speed", color: PELLET_KINDS.speed.color },
  { ch: "T", kind: "trap", color: PELLET_KINDS.trap.color },
  { ch: "W", kind: "teleport", color: WORMHOLE_COLOR },
];
const ENERGIZER_COLOR = PELLET_KINDS.energizer.color;

// Diagonal "scan" reveal on a full-grid swap (mirrors the pathfinding randomize):
// each tile materialises when the wavefront (col+row)*delay reaches it, flashing
// the accent before settling. Tuned like pathfinding's delayMult / 0.48s.
const SCAN_DELAY_MULT = Math.min(15, 800 / (COLS + ROWS));
const SCAN_DURATION = 480;

// Subtle reveal for a content-only change (randomize/preset specials): the walls
// stay put and only the special pellets pop in - scaling up with a soft glow,
// staggered gently outward from the board centre. Much quieter than the scan.
const POP_STAGGER = 8;
const POP_DURATION = 360;
const POP_CHARS = new Set(["D", "F", "S", "T", "W"]);

/** Ease-out-back: overshoots slightly past 1 before settling, for a lively pop. */
function easeOutBack(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/**
 * Scatter the special content over reachable dot tiles, mirrored left/right to
 * match the symmetric board. Energizers are left untouched so the board stays
 * valid; a single wormhole pair is placed as one mirrored tile + its mirror.
 */
function randomizeContent(base: MazeGrid): MazeGrid {
  const stripped = stripContent(base);
  const rows = stripped.map((r) => r.split(""));
  const reachable = validateMaze(stripped).reachable;
  const cands: [number, number][] = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c <= 12; c++) {
      if (!isLocked(c, r) && rows[r][c] === "." && reachable.has(tileKey(c, r))) cands.push([c, r]);
    }
  }
  for (let i = cands.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cands[i], cands[j]] = [cands[j], cands[i]];
  }
  let i = 0;
  const placeSym = (ch: string) => {
    if (i >= cands.length) return;
    const [c, r] = cands[i++];
    rows[r][c] = ch;
    const m = COLS - 1 - c;
    if (!isLocked(m, r) && rows[r][m] === "." && reachable.has(tileKey(m, r))) rows[r][m] = ch;
  };
  const plan: [string, number][] = [
    ["D", 2],
    ["F", 2],
    ["S", 2],
    ["T", 3],
    ["W", 1],
  ];
  for (const [ch, n] of plan) for (let k = 0; k < n; k++) placeSym(ch);
  return rows.map((r) => r.join(""));
}

interface Props {
  initialGrid: MazeGrid;
  initialName: string;
  onPlay: (grid: MazeGrid, name: string) => void;
  onCancel: () => void;
}

export default function MazeEditor({ initialGrid, initialName, onPlay, onCancel }: Props) {
  const { t } = useTranslation();
  const [grid, setGrid] = useState<MazeGrid>(() => applyStructure(initialGrid));
  const [brush, setBrush] = useState<Brush>("#");
  const [name, setName] = useState(initialName);
  const [custom, setCustom] = useState<MazeEntry[]>(() => loadCustomMazes());
  const [io, setIo] = useState("");
  const [ioMsg, setIoMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const animStartRef = useRef<number | null>(null);
  const animModeRef = useRef<"scan" | "pop" | null>(null);
  const rafRef = useRef(0);
  const accentRef = useRef("#4ade80");

  const validation = useMemo(() => validateMaze(grid), [grid]);

  // Latest grid/validation in refs so the rAF scan loop reads them without a
  // stale closure. Synced after commit; swap handlers also set gridRef eagerly.
  const gridRef = useRef(grid);
  const validationRef = useRef(validation);
  useEffect(() => {
    gridRef.current = grid;
    validationRef.current = validation;
  });

  // --- Draw -------------------------------------------------------------
  const draw = useCallback((nowArg?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const grid = gridRef.current;
    const validation = validationRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const tile = TILE_PX;
    if (canvas.width !== COLS * tile * dpr) {
      canvas.width = COLS * tile * dpr;
      canvas.height = ROWS * tile * dpr;
    }
    const pal = readPalette();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, COLS * tile, ROWS * tile);

    const anim = animStartRef.current;
    const mode = anim !== null ? animModeRef.current : null;
    const scanning = mode === "scan";
    const popping = mode === "pop";
    const elapsed = anim !== null ? (nowArg ?? performance.now()) - anim : 0;
    const cx = COLS / 2;
    const cy = ROWS / 2;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let flash = 0;
        if (scanning) {
          const local = elapsed - (c + r) * SCAN_DELAY_MULT;
          if (local < 0) continue; // wavefront has not reached this tile yet
          flash = Math.max(0, 1 - local / SCAN_DURATION);
        }
        // Content pop: only the special pellets animate, blooming out from centre.
        let pop = 1;
        let popGlow = 0;
        if (popping && POP_CHARS.has(grid[r][c])) {
          const delay = Math.hypot(c - cx, r - cy) * POP_STAGGER;
          const p = Math.min(1, Math.max(0, (elapsed - delay) / POP_DURATION));
          pop = easeOutBack(p);
          popGlow = 1 - p;
        }
        const x = c * tile;
        const y = r * tile;
        const ch = grid[r][c];
        const locked = isLocked(c, r);
        if (locked) {
          ctx.fillStyle = pal.wall;
          ctx.globalAlpha = 0.06;
          ctx.fillRect(x, y, tile, tile);
          ctx.globalAlpha = 1;
        }
        if (ch === "#") {
          ctx.fillStyle = pal.wall;
          ctx.globalAlpha = locked ? 0.32 : 0.6;
          ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
          ctx.globalAlpha = 1;
        } else if (ch === "-") {
          ctx.fillStyle = pal.gate;
          ctx.fillRect(x, y + tile * 0.42, tile, tile * 0.16);
        } else if (ch === ".") {
          ctx.fillStyle = validation.reachable.has(tileKey(c, r)) ? pal.pellet : FRUIT_COLOR;
          ctx.beginPath();
          ctx.arc(x + tile / 2, y + tile / 2, tile * 0.12, 0, Math.PI * 2);
          ctx.fill();
        } else if (ch === "o") {
          ctx.fillStyle = validation.reachable.has(tileKey(c, r)) ? ENERGIZER_COLOR : FRUIT_COLOR;
          ctx.beginPath();
          ctx.arc(x + tile / 2, y + tile / 2, tile * 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else if (ch === "D" || ch === "F" || ch === "S" || ch === "T") {
          const color = validation.reachable.has(tileKey(c, r))
            ? PELLET_KINDS[CHAR_KIND[ch]].color
            : FRUIT_COLOR;
          ctx.fillStyle = color;
          if (popGlow > 0) {
            ctx.shadowBlur = tile * 0.6 * popGlow;
            ctx.shadowColor = color;
          }
          ctx.beginPath();
          ctx.arc(x + tile / 2, y + tile / 2, tile * 0.26 * pop, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (ch === "W") {
          ctx.strokeStyle = WORMHOLE_COLOR;
          ctx.lineWidth = Math.max(1, tile * 0.12);
          if (popGlow > 0) {
            ctx.shadowBlur = tile * 0.6 * popGlow;
            ctx.shadowColor = WORMHOLE_COLOR;
          }
          ctx.beginPath();
          ctx.arc(x + tile / 2, y + tile / 2, tile * 0.28 * pop, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        if (flash > 0) {
          ctx.fillStyle = accentRef.current;
          ctx.globalAlpha = 0.9 * flash;
          ctx.fillRect(x, y, tile, tile);
          ctx.globalAlpha = 1;
        }
      }
    }

    // Grid lines (skipped mid-scan so tiles appear to materialise from nothing).
    if (!scanning) {
      ctx.strokeStyle = pal.wall;
      ctx.globalAlpha = 0.08;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 0; c <= COLS; c++) {
        ctx.moveTo(c * tile, 0);
        ctx.lineTo(c * tile, ROWS * tile);
      }
      for (let r = 0; r <= ROWS; r++) {
        ctx.moveTo(0, r * tile);
        ctx.lineTo(COLS * tile, r * tile);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, []);

  // Static repaint on edits / validation change - but never fight the scan loop.
  useEffect(() => {
    if (animStartRef.current === null) draw();
  }, [grid, validation, draw]);

  // Run a timed canvas animation: redraw each frame until `total` ms elapse.
  const runAnim = useCallback(
    (mode: "scan" | "pop", total: number) => {
      cancelAnimationFrame(rafRef.current);
      if (prefersReducedMotion()) {
        animStartRef.current = null;
        animModeRef.current = null;
        draw();
        return;
      }
      const start = performance.now();
      animStartRef.current = start;
      animModeRef.current = mode;
      const loop = (now: number) => {
        draw(now);
        if (animStartRef.current === start && now - start < total) {
          rafRef.current = requestAnimationFrame(loop);
        } else if (animStartRef.current === start) {
          animStartRef.current = null;
          animModeRef.current = null;
          draw();
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    },
    [draw],
  );

  // Big diagonal materialise - for a full maze swap (walls change).
  const runScan = useCallback(() => {
    accentRef.current =
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() ||
      accentRef.current;
    runAnim("scan", (COLS - 1 + (ROWS - 1)) * SCAN_DELAY_MULT + SCAN_DURATION);
  }, [runAnim]);

  // Subtle pellet bloom - for a content-only change (walls unchanged).
  const runContentPop = useCallback(() => {
    runAnim("pop", Math.hypot(COLS / 2, ROWS / 2) * POP_STAGGER + POP_DURATION);
  }, [runAnim]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // --- Painting ---------------------------------------------------------
  const paintAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const col = Math.floor(((clientX - rect.left) / rect.width) * COLS);
      const row = Math.floor(((clientY - rect.top) / rect.height) * ROWS);
      setGrid((g) => setCell(g, col, row, brush));
    },
    [brush],
  );

  const onDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      painting.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      paintAt(e.clientX, e.clientY);
    },
    [paintAt],
  );
  const onMoveCanvas = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (painting.current) paintAt(e.clientX, e.clientY);
    },
    [paintAt],
  );
  const onUp = useCallback(() => {
    painting.current = false;
  }, []);

  // --- Actions ----------------------------------------------------------
  // Replace the whole grid and play the scan reveal. gridRef is set eagerly so
  // the first animation frame already reads the new layout.
  const swapGrid = useCallback(
    (next: MazeGrid) => {
      gridRef.current = next;
      setGrid(next);
      setIoMsg(null);
      runScan();
    },
    [runScan],
  );

  const loadEntry = useCallback(
    (entry: MazeEntry) => {
      swapGrid(applyStructure(entry.grid.slice()));
      setName(entry.builtin ? "" : entry.name);
    },
    [swapGrid],
  );

  const onRandom = useCallback(() => swapGrid(generateMaze()), [swapGrid]);
  const onClear = useCallback(() => swapGrid(blankGrid()), [swapGrid]);

  // Content-only swaps keep the walls and play the subtle pellet bloom instead.
  const swapContent = useCallback(
    (next: MazeGrid) => {
      gridRef.current = next;
      setGrid(next);
      setIoMsg(null);
      runContentPop();
    },
    [runContentPop],
  );
  const onRandomizeContent = useCallback(
    () => swapContent(randomizeContent(gridRef.current)),
    [swapContent],
  );
  const onPresetContent = useCallback(
    () => swapContent(applyClassicContent(gridRef.current)),
    [swapContent],
  );
  const onStripContent = useCallback(() => swapContent(stripContent(gridRef.current)), [swapContent]);

  const onSave = useCallback(() => {
    setCustom(saveCustomMaze(name, grid));
    setIoMsg(t("experiments.pacman.editor_saved"));
  }, [name, grid, t]);

  const onDelete = useCallback((id: string) => {
    setCustom(deleteCustomMaze(id));
  }, []);

  const onExport = useCallback(() => {
    const code = encodeMaze(grid);
    setIo(code);
    void navigator.clipboard?.writeText(code).catch(() => {});
    setIoMsg(t("experiments.pacman.editor_copied"));
  }, [grid, t]);

  const onImport = useCallback(() => {
    const decoded = decodeMaze(io);
    if (decoded) {
      const next = applyStructure(decoded);
      gridRef.current = next;
      setGrid(next);
      runScan();
      setIoMsg(t("experiments.pacman.editor_imported"));
    } else {
      setIoMsg(t("experiments.pacman.editor_import_bad"));
    }
  }, [io, t, runScan]);

  const allEntries = [...BUILTIN_MAZES, ...custom];
  const entryName = (e: MazeEntry) =>
    e.builtin ? t(`experiments.pacman.maze_${e.name}`) : e.name;

  return (
    <div className="pacman-editor">
      <div className="pacman-editor-stage">
        <canvas
          ref={canvasRef}
          className="pacman-editor-canvas"
          onPointerDown={onDown}
          onPointerMove={onMoveCanvas}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          aria-label={t("experiments.pacman.editor_canvas_aria")}
        />
        <p className={`pacman-editor-status${validation.ok ? " is-ok" : ""}`}>
          {validation.ok ? (
            <ScrambleText
              text={t("experiments.pacman.editor_valid", {
                pellets: validation.pellets,
                energizers: validation.energizers,
              })}
              duration={400}
            />
          ) : (
            <ScrambleText
              text={validation.errors
                .map((code) => t(`experiments.pacman.editor_err_${code}`))
                .join(" · ")}
              duration={400}
            />
          )}
        </p>
      </div>

      <div className="pacman-editor-controls">
        <Panel title={t("experiments.pacman.editor_brush")} collapsible={false}>
          <div className="pacman-toggles">
            {TERRAIN.map((b) => (
              <Button
                key={b.ch}
                size="sm"
                variant={brush === b.ch ? "primary" : "ghost"}
                aria-pressed={brush === b.ch}
                onClick={() => setBrush(b.ch)}
              >
                {t(`experiments.pacman.brush_${b.key}`)}
              </Button>
            ))}
          </div>
          <span className="pacman-strip-label">
            <ScrambleText text={t("experiments.pacman.editor_content")} duration={400} />
          </span>
          <div className="pacman-toggles">
            {CONTENT.map((b) => (
              <Button
                key={b.ch}
                size="sm"
                variant={brush === b.ch ? "primary" : "ghost"}
                aria-pressed={brush === b.ch}
                className="pacman-chip"
                onClick={() => setBrush(b.ch)}
              >
                <span className="pacman-chip-dot" style={{ background: b.color }} />
                {t(`experiments.pacman.pellet_${b.kind}`)}
              </Button>
            ))}
          </div>
          <div className="pacman-toggles">
            <Button size="sm" variant="accent" onClick={onRandomizeContent}>
              <ScrambleText text={t("experiments.pacman.editor_randomize")} duration={400} />
            </Button>
            <Button size="sm" variant="ghost" onClick={onPresetContent}>
              <ScrambleText text={t("experiments.pacman.editor_preset")} duration={400} />
            </Button>
            <Button size="sm" variant="ghost" onClick={onStripContent}>
              <ScrambleText text={t("experiments.pacman.editor_strip")} duration={400} />
            </Button>
          </div>
          <p className="pacman-editor-hint">
            <ScrambleText text={t("experiments.pacman.editor_paint_hint")} duration={400} />
          </p>
        </Panel>

        <Panel title={t("experiments.pacman.editor_layouts")} collapsible={false}>
          <div className="pacman-toggles">
            {allEntries.map((e) => (
              <span key={e.id} className="pacman-maze-row">
                <Button size="sm" variant="ghost" onClick={() => loadEntry(e)}>
                  {entryName(e)}
                </Button>
                {!e.builtin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t("experiments.pacman.editor_delete", { name: e.name })}
                    onClick={() => onDelete(e.id)}
                  >
                    ✕
                  </Button>
                )}
              </span>
            ))}
          </div>
          <div className="pacman-toggles">
            <Button size="sm" variant="accent" onClick={onRandom}>
              <ScrambleText text={t("experiments.pacman.editor_random")} duration={400} />
            </Button>
            <Button size="sm" variant="ghost" onClick={onClear}>
              <ScrambleText text={t("experiments.pacman.editor_clear")} duration={400} />
            </Button>
          </div>
        </Panel>

        <Panel title={t("experiments.pacman.editor_save")} collapsible={false}>
          <div className="pacman-editor-saverow">
            <input
              className="pacman-editor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("experiments.pacman.editor_name_ph")}
              aria-label={t("experiments.pacman.editor_name_ph")}
            />
            <Button size="sm" variant="ghost" onClick={onSave}>
              <ScrambleText text={t("experiments.pacman.editor_save_btn")} duration={400} />
            </Button>
          </div>
          <div className="pacman-toggles">
            <Button size="sm" variant="ghost" onClick={onExport}>
              <ScrambleText text={t("experiments.pacman.editor_export")} duration={400} />
            </Button>
            <Button size="sm" variant="ghost" onClick={onImport}>
              <ScrambleText text={t("experiments.pacman.editor_import")} duration={400} />
            </Button>
          </div>
          <textarea
            className="pacman-editor-io"
            value={io}
            onChange={(e) => setIo(e.target.value)}
            placeholder={t("experiments.pacman.editor_io_ph")}
            aria-label={t("experiments.pacman.editor_io_ph")}
            rows={2}
          />
          {ioMsg && <p className="pacman-editor-hint">{ioMsg}</p>}
        </Panel>

        <div className="pacman-editor-actions">
          <Button
            variant="primary"
            onClick={() => onPlay(grid, name)}
            disabled={!validation.ok}
            tooltip={validation.ok ? undefined : t("experiments.pacman.editor_fix_first")}
          >
            <ScrambleText text={t("experiments.pacman.editor_play")} duration={400} />
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            <ScrambleText text={t("experiments.pacman.editor_cancel")} duration={400} />
          </Button>
        </div>
      </div>
    </div>
  );
}
