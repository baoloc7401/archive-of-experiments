import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function mql(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(QUERY);
}

/** Imperative one-shot read - use inside event handlers, loops, or refs. */
export function prefersReducedMotion(): boolean {
  return mql()?.matches ?? false;
}

function subscribe(onChange: () => void): () => void {
  const m = mql();
  if (!m) return () => {};
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}

/**
 * Reactive `prefers-reduced-motion` for components - re-renders when the OS
 * preference changes. For imperative reads (animation loops, handlers) use
 * {@link prefersReducedMotion} instead.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => prefersReducedMotion(),
    () => false,
  );
}
