import { useEffect, useState } from "react";

const GLYPHS = "!<>-_\\/[]{}-=+*^?#%$@01";

export interface Options {
  startDelay?: number;
  charDelay?: number;
  /** Cap the total scramble runtime by shrinking charDelay for long strings. */
  maxDuration?: number;
  /** Target total runtime regardless of length - short texts slow down so
   *  every wrapped string finishes at the same moment. Overrides charDelay. */
  duration?: number;
}

function randGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

/** A fully-scrambled version of `target` (spaces and hyphens kept in place). */
export function scrambled(target: string) {
  let out = "";
  for (let i = 0; i < target.length; i++) {
    const ch = target[i];
    out += ch === " " || ch === "-" ? ch : randGlyph();
  }
  return out;
}

/** Per-character delay implied by the options for a string of length `len`. */
export function effectiveDelayFor(len: number, options: Options): number {
  const { charDelay = 50, maxDuration, duration } = options;
  const n = Math.max(1, len);
  if (duration != null) return duration / n;
  if (maxDuration != null) return Math.min(charDelay, maxDuration / n);
  return charDelay;
}

/** The display string at `elapsed` ms, and whether every char has settled. */
export function frameAt(
  text: string,
  elapsed: number,
  startDelay: number,
  effectiveDelay: number
): { next: string; settled: boolean } {
  let next = "";
  let settled = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " " || ch === "-") {
      next += ch;
      continue;
    }
    if (elapsed >= startDelay + i * effectiveDelay) {
      next += ch;
    } else {
      next += randGlyph();
      settled = false;
    }
  }
  return { next, settled };
}

/** Hook form - useful when the scrambled string needs to flow into an
 *  attribute (e.g. an input's placeholder). For text nodes, prefer the
 *  ScrambleText component, which animates via a ref without re-rendering. */
export function useScrambledText(text: string, options: Options = {}): string {
  const { startDelay = 0, charDelay, maxDuration, duration } = options;
  const [display, setDisplay] = useState<string>(() => scrambled(text));
  const [prevText, setPrevText] = useState(text);

  // Reset to a freshly scrambled string the instant `text` changes - React's
  // "adjust state during render" pattern. Doing it here rather than in the
  // effect below avoids both a frame of stale text and a setState-in-effect.
  if (text !== prevText) {
    setPrevText(text);
    setDisplay(scrambled(text));
  }

  useEffect(() => {
    const effectiveDelay = effectiveDelayFor(text.length, {
      charDelay,
      maxDuration,
      duration,
    });
    const start = performance.now();
    let frame = 0;

    function tick(now: number) {
      const { next, settled } = frameAt(
        text,
        now - start,
        startDelay,
        effectiveDelay
      );
      setDisplay(next);
      if (!settled) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, startDelay, charDelay, maxDuration, duration]);

  return display;
}
