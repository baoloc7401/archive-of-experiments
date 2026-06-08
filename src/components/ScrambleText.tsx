import { useLayoutEffect, useRef } from "react";
import {
  effectiveDelayFor,
  frameAt,
  scrambled,
  type Options,
} from "./useScrambledText";
import { prefersReducedMotion } from "../hooks/useReducedMotion";

interface Props extends Options {
  text: string;
}

/**
 * Animated scramble-in text. The rAF loop writes `textContent` on a ref'd span
 * instead of calling setState, so the (often dozens of) instances on a page
 * don't trigger a React render every frame - that render storm was the main
 * source of main-thread blocking (TBT) on load. React owns the span's text
 * (children={text}) only when `text` actually changes (e.g. language toggle);
 * between those it never touches the DOM, so the ref-driven animation is safe.
 */
export default function ScrambleText({
  text,
  startDelay = 0,
  charDelay,
  maxDuration,
  duration,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Decorative animation - settle instantly when motion is reduced.
    if (prefersReducedMotion()) {
      node.textContent = text;
      return;
    }

    const effectiveDelay = effectiveDelayFor(text.length, {
      charDelay,
      maxDuration,
      duration,
    });
    // Set the scrambled start state before paint so there's no flash of the
    // settled string (this layout effect runs before the browser paints).
    node.textContent = scrambled(text);

    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now: number) {
      const { next, settled } = frameAt(
        text,
        now - start,
        startDelay,
        effectiveDelay
      );
      node.textContent = next;
      if (!settled) frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [text, startDelay, charDelay, maxDuration, duration]);

  return <span ref={ref}>{text}</span>;
}
