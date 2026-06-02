import { useEffect, useState } from "react";

const GLYPHS = "!<>-_\\/[]{}—=+*^?#%$@01";

export interface Options {
  startDelay?: number;
  charDelay?: number;
  /** Cap the total scramble runtime by shrinking charDelay for long strings. */
  maxDuration?: number;
  /** Target total runtime regardless of length — short texts slow down so
   *  every wrapped string finishes at the same moment. Overrides charDelay. */
  duration?: number;
}

function randGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

function scrambled(target: string) {
  let out = "";
  for (let i = 0; i < target.length; i++) {
    const ch = target[i];
    out += ch === " " || ch === "-" ? ch : randGlyph();
  }
  return out;
}

/** Hook form — useful when the scrambled string needs to flow into an
 *  attribute (e.g. an input's placeholder). For text nodes, prefer the
 *  ScrambleText component. */
export function useScrambledText(text: string, options: Options = {}): string {
  const { startDelay = 0, charDelay = 50, maxDuration, duration } = options;
  const [display, setDisplay] = useState<string>(() => scrambled(text));
  const [prevText, setPrevText] = useState(text);

  // Reset to a freshly scrambled string the instant `text` changes — React's
  // "adjust state during render" pattern. Doing it here rather than in the
  // effect below avoids both a frame of stale text and a setState-in-effect.
  if (text !== prevText) {
    setPrevText(text);
    setDisplay(scrambled(text));
  }

  useEffect(() => {
    const len = Math.max(1, text.length);
    const effectiveDelay =
      duration != null
        ? duration / len
        : maxDuration != null
          ? Math.min(charDelay, maxDuration / len)
          : charDelay;

    const start = performance.now();
    let frame = 0;

    function tick(now: number) {
      const elapsed = now - start;
      let allSettled = true;
      let next = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === " " || ch === "-") {
          next += ch;
          continue;
        }
        const settleAt = startDelay + i * effectiveDelay;
        if (elapsed >= settleAt) {
          next += ch;
        } else {
          next += randGlyph();
          allSettled = false;
        }
      }
      setDisplay(next);
      if (!allSettled) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, startDelay, charDelay, maxDuration, duration]);

  return display;
}
