import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Button, Panel } from "@/components/ui";
import type { PaletteId, RuleGenome } from "../types";
import { LITTER_SIZE, MINI_H, MINI_W } from "../constants";
import { breedLitter, createRng, ruleToString } from "../rules";
import { createGrid, drawGrid, randomizeGrid, stepGrid } from "../miniSim";
import { paletteColors255 } from "../palettes";

interface Props {
  genome: RuleGenome;
  palette: PaletteId;
  /** Adopts an offspring's genome as the new main rule (caller also reseeds the main canvas). */
  onAdopt: (genome: RuleGenome) => void;
}

interface Slot {
  genome: RuleGenome;
  grid: Uint8Array;
  next: Uint8Array;
  colors: Uint8ClampedArray;
}

/** Fixed soup density for the lab's own thumbnails, independent of the main canvas's density slider. */
const LAB_DENSITY = 0.3;
/** Throttles actual generation steps to ~9/sec (not every rAF frame) - plenty lively, cheap. */
const STEP_MS = 110;
/** Clamp a huge frame gap (e.g. the tab was backgrounded) so the lab doesn't try to catch up. */
const MAX_DT = 250;

/** Deterministic seed derived from a genome's own values (no Date.now/Math.random - keeps the
 *  genome-driven litter a pure function of `genome`, safe to compute during render via useMemo). */
function hashGenome(g: RuleGenome): number {
  return ((g.birth * 2654435761) ^ (g.survive * 40503) ^ (g.states * 2246822519)) >>> 0;
}

function makeSlot(genome: RuleGenome, palette: PaletteId, rng: () => number): Slot {
  const grid = createGrid(MINI_W, MINI_H);
  randomizeGrid(grid, MINI_W, MINI_H, LAB_DENSITY, rng);
  return { genome, grid, next: createGrid(MINI_W, MINI_H), colors: paletteColors255(palette, genome.states) };
}

/**
 * The signature feature: the current rule plus LITTER_SIZE randomly-mutated
 * offspring run live, continuously, as small CPU-simulated thumbnails (no
 * WebGL context - a 40x26 grid is trivially cheap in plain JS, and spinning
 * up 6+ extra GL contexts alongside the main canvas would be the wrong
 * tradeoff). Clicking an offspring adopts its genome as the new rule -
 * mutate, select, repeat.
 *
 * All simulation state (the Uint8Array grids) lives in plain closure
 * variables inside a single long-lived rAF effect, never in a ref mutated
 * from multiple places - the "genome changed" / "palette changed" reactions
 * are just identity checks run every frame against a synced "latest props"
 * ref, so there is exactly one owner of the mutable simulation state.
 */
export default function BreedingLab({ genome, palette, onAdopt }: Props) {
  const { t } = useTranslation();
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  // Genome-driven litter: a pure function of `genome` alone (seeded from the
  // genome's own values, not wall-clock time), so it's safe to memoize during
  // render. Reconciled against a manual re-roll via React's own documented
  // "adjust state when a prop changes" pattern (setState conditionally during
  // render, not in an effect) so a genome change always wins over whatever
  // litter was showing before.
  const baseLitter = useMemo(
    () => breedLitter(genome, LITTER_SIZE, createRng(hashGenome(genome))),
    [genome],
  );
  const [litter, setLitter] = useState(baseLitter);
  const [litterSource, setLitterSource] = useState(genome);
  if (genome !== litterSource) {
    setLitterSource(genome);
    setLitter(baseLitter);
  }

  const handleNewLitter = useCallback(() => {
    setLitter(breedLitter(genome, LITTER_SIZE, createRng(Date.now())));
  }, [genome]);

  // Latest props, synced from an effect (never written inline during render) -
  // read every frame by the rAF loop below without being a reactive dependency.
  const latestRef = useRef({ litter, genome, palette });
  useEffect(() => {
    latestRef.current = { litter, genome, palette };
  }, [litter, genome, palette]);

  // One shared rAF loop, mounted once: owns every slot's grid, steps +
  // redraws them together (throttled via a time accumulator), and detects
  // genome/litter/palette changes by comparing against what it last saw.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let acc = 0;
    let current: Slot | null = null;
    let offspring: Slot[] = [];
    let seenGenome: RuleGenome | null = null;
    let seenLitter: RuleGenome[] | null = null;
    let seenPalette: PaletteId | null = null;

    const sync = () => {
      const { litter: curLitter, genome: curGenome, palette: curPalette } = latestRef.current;
      if (curGenome !== seenGenome) {
        seenGenome = curGenome;
        current = makeSlot(curGenome, curPalette, Math.random);
      }
      if (curLitter !== seenLitter) {
        seenLitter = curLitter;
        offspring = curLitter.map((g) => makeSlot(g, curPalette, Math.random));
      }
      if (curPalette !== seenPalette) {
        seenPalette = curPalette;
        if (current) current.colors = paletteColors255(curPalette, current.genome.states);
        for (const slot of offspring) slot.colors = paletteColors255(curPalette, slot.genome.states);
      }
    };

    const drawAll = () => {
      const all = current ? [current, ...offspring] : offspring;
      for (let i = 0; i < all.length; i++) {
        const canvas = canvasRefs.current[i];
        const ctx = canvas?.getContext("2d");
        if (ctx) drawGrid(ctx, all[i].grid, MINI_W, MINI_H, all[i].colors);
      }
    };

    const loop = (now: number) => {
      sync();
      const dt = last > 0 ? Math.min(now - last, MAX_DT) : 0;
      last = now;
      acc += dt;
      if (acc >= STEP_MS) {
        acc = 0;
        const all = current ? [current, ...offspring] : offspring;
        for (const slot of all) {
          stepGrid(slot.grid, slot.next, MINI_W, MINI_H, slot.genome, true);
          const tmp = slot.grid;
          slot.grid = slot.next;
          slot.next = tmp;
        }
      }
      drawAll();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Panel title={t("experiments.cellular-automata.lab_title")}>
      <p className="ca-lab-hint">
        <ScrambleText text={t("experiments.cellular-automata.lab_hint")} duration={500} />
      </p>

      <div className="ca-lab-current">
        <canvas
          ref={(el) => {
            canvasRefs.current[0] = el;
          }}
          className="ca-mini-canvas"
          width={MINI_W}
          height={MINI_H}
          aria-hidden="true"
        />
        <span className="ca-lab-badge">
          <ScrambleText text={t("experiments.cellular-automata.lab_current")} duration={400} />
        </span>
      </div>

      <div className="ca-lab-grid">
        {litter.map((g, i) => (
          <button
            key={i}
            type="button"
            className="ca-lab-offspring"
            aria-label={t("experiments.cellular-automata.lab_adopt_aria", { rule: ruleToString(g) })}
            onClick={() => onAdopt(g)}
          >
            <canvas
              ref={(el) => {
                canvasRefs.current[i + 1] = el;
              }}
              className="ca-mini-canvas"
              width={MINI_W}
              height={MINI_H}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      <div className="ca-actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewLitter}
          tooltip={t("experiments.cellular-automata.new_litter_hint")}
        >
          <ScrambleText text={t("experiments.cellular-automata.new_litter")} duration={400} />
        </Button>
      </div>
    </Panel>
  );
}
