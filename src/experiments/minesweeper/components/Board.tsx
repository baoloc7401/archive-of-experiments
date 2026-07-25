import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { CellView, GameStatus, Minefield } from "../types";

interface Props {
  field: Minefield | null;
  view: CellView[];
  width: number;
  height: number;
  status: GameStatus;
  mineHit: number | null;
  peek: boolean;
  undecided: number[];
  flagMode: boolean;
  /** Disable interaction (e.g. while the auto-solver is playing). */
  locked: boolean;
  /** Cell the solver recommends clicking when stuck. */
  bestGuess: number | null;
  /** Per-cell mine probability overlay (from the probabilistic solver). */
  probabilities: Map<number, number> | null;
  onReveal: (i: number) => void;
  onChord: (i: number) => void;
  onFlag: (i: number) => void;
}

/** Long-press duration (touch) before a press becomes a flag instead of a reveal. */
const LONG_PRESS_MS = 450;

export default function Board({
  field,
  view,
  width,
  height,
  status,
  mineHit,
  peek,
  undecided,
  flagMode,
  locked,
  bestGuess,
  probabilities,
  onReveal,
  onChord,
  onFlag,
}: Props) {
  const { t } = useTranslation();
  const undecidedSet = useMemo(() => new Set(undecided), [undecided]);
  const over = status === "won" || status === "lost";
  const showProbs = !!probabilities && !over;
  const showPctText = width <= 20; // numbers get unreadable on a 30-wide board

  // Roving-tabindex cursor: one tab-stop into the grid; arrows move DOM focus.
  const [cursor, setCursor] = useState(0);
  const longPressed = useRef(false);
  const pressTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  }, []);

  function act(i: number) {
    if (view[i] === "revealed" && field && field.cells[i].adjacent > 0) onChord(i);
    else onReveal(i);
  }

  function handleClick(i: number) {
    if (longPressed.current) {
      longPressed.current = false; // a long-press already flagged it; swallow the click
      return;
    }
    if (flagMode) onFlag(i);
    else act(i);
  }

  function handlePointerDown(e: React.PointerEvent, i: number) {
    if (e.pointerType !== "touch" || flagMode || over || locked) return;
    longPressed.current = false;
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      onFlag(i);
    }, LONG_PRESS_MS);
  }
  function cancelPress() {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const x = cursor % width;
    const y = (cursor / width) | 0;
    let nx = x;
    let ny = y;
    if (e.key === "ArrowRight") nx = Math.min(width - 1, x + 1);
    else if (e.key === "ArrowLeft") nx = Math.max(0, x - 1);
    else if (e.key === "ArrowDown") ny = Math.min(height - 1, y + 1);
    else if (e.key === "ArrowUp") ny = Math.max(0, y - 1);
    else if (e.key === "Home") nx = 0;
    else if (e.key === "End") nx = width - 1;
    else if (e.key === "f" || e.key === "F") {
      if (!over && !locked) {
        e.preventDefault();
        onFlag(cursor);
      }
      return;
    } else return;
    e.preventDefault();
    const next = ny * width + nx;
    setCursor(next);
    document.getElementById(`ms-cell-${next}`)?.focus();
  }

  return (
    <div
      className={`ms-board${over ? " ms-board--over" : ""}`}
      style={{ "--cols": width, "--rows": height } as React.CSSProperties}
      role="grid"
      aria-label={t("experiments.minesweeper.aria.board", { w: width, h: height })}
      onKeyDown={handleKeyDown}
    >
      {Array.from({ length: width * height }, (_, i) => {
        const v = view[i];
        const cell = field?.cells[i];
        const isMine = cell?.mine ?? false;
        const num = cell?.adjacent ?? 0;

        let cls = "ms-cell";
        let content = "";
        let style: React.CSSProperties | undefined;
        let label = t("experiments.minesweeper.aria.cell", { x: i % width, y: (i / width) | 0 });

        if (v === "revealed") {
          if (isMine) {
            cls += i === mineHit ? " ms-cell--boom" : " ms-cell--mine";
            content = "✸";
            label += `, ${t("experiments.minesweeper.aria.mine")}`;
          } else {
            cls += " ms-cell--open";
            if (num > 0) {
              cls += ` ms-n${num}`;
              content = String(num);
              label += `, ${num}`;
            } else label += `, ${t("experiments.minesweeper.aria.empty")}`;
          }
        } else {
          cls += " ms-cell--hidden";
          if (v === "flagged") {
            cls += " ms-cell--flag";
            content = "⚑";
            label += `, ${t("experiments.minesweeper.aria.flagged")}`;
            if (over && field && !isMine) cls += " ms-cell--wrong";
          } else {
            label += `, ${t("experiments.minesweeper.aria.hidden")}`;
            const p = showProbs ? probabilities!.get(i) : undefined;
            if (p !== undefined) {
              cls += " ms-cell--prob";
              style = { backgroundColor: `hsl(${(1 - p) * 130}, 55%, 42%)` };
              if (showPctText) content = String(Math.round(p * 100));
              label += `, ${t("experiments.minesweeper.aria.mine_pct", { pct: (p * 100).toFixed(0) })}`;
            } else if (peek && field) {
              if (isMine) cls += " ms-cell--peek-mine";
              else if (undecidedSet.has(i)) cls += " ms-cell--peek-undecided";
            }
            if (i === bestGuess && !over) cls += " ms-cell--guess";
          }
        }

        return (
          <button
            key={i}
            id={`ms-cell-${i}`}
            type="button"
            className={cls}
            style={style}
            role="gridcell"
            tabIndex={i === cursor ? 0 : -1}
            disabled={(over && v !== "flagged") || locked}
            aria-label={label}
            onFocus={() => setCursor(i)}
            onClick={() => handleClick(i)}
            onContextMenu={(e) => {
              e.preventDefault();
              onFlag(i);
            }}
            onPointerDown={(e) => handlePointerDown(e, i)}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
