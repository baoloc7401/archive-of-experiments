import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import { FACE_DIZZY, FACE_GRAB } from "./constants";

type Mood = "idle" | "grab" | "dizzy";

const FACE_CYCLE_MS = 3200;
const MARGIN = 44;
const WALL_BOUNCE = 0.72;
const DAMPING = 0.99;
const FLING_DIZZY_SPEED = 7;
const MAX_VEL = 42;

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

interface MascotView {
  face: string;
  grabbed: boolean;
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
}

/**
 * Free-floating mascot you can grab and fling. A rAF loop integrates velocity,
 * bounces off the container walls with damping, and nudges itself with tiny
 * ambient impulses so it drifts even when left alone (it is lost in the void,
 * after all). The transform is written straight to the DOM each frame; only the
 * mood (which face to show) lives in React state. Inert under reduced motion.
 */
export function useMascotPhysics(
  containerRef: RefObject<HTMLElement | null>,
  elRef: RefObject<HTMLDivElement | null>,
  faces: string[],
  reduced: boolean
): MascotView {
  const pos = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const drag = useRef({ x: 0, y: 0, t: 0 });
  const dizzyUntil = useRef(0);
  const moodRef = useRef<Mood>("idle");
  const rafRef = useRef(0);

  const [mood, setMood] = useState<Mood>("idle");
  const [faceIdx, setFaceIdx] = useState(0);

  const setMoodSafe = useCallback((m: Mood) => {
    if (moodRef.current !== m) {
      moodRef.current = m;
      setMood(m);
    }
  }, []);

  // Idle mascot keeps second-guessing how it feels.
  useEffect(() => {
    if (reduced || faces.length < 2) return;
    const id = window.setInterval(
      () => setFaceIdx((p) => (p + 1) % faces.length),
      FACE_CYCLE_MS
    );
    return () => window.clearInterval(id);
  }, [reduced, faces.length]);

  // Physics loop.
  useEffect(() => {
    if (reduced) return;
    const container = containerRef.current;
    const el = elRef.current;
    if (!container || !el) return;

    const b = container.getBoundingClientRect();
    pos.current = { x: b.width / 2, y: b.height * 0.3 };
    el.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) translate(-50%, -50%)`;
    let last = performance.now();
    let ambient = 0;

    const tick = (now: number) => {
      const dt = Math.min(40, now - last) / 16.67;
      last = now;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (!dragging.current) {
        const slow =
          Math.abs(vel.current.x) < 0.35 && Math.abs(vel.current.y) < 0.35;
        ambient += 1;
        if (ambient > 80 && slow) {
          vel.current.x += (Math.random() - 0.5) * 1.8;
          vel.current.y += (Math.random() - 0.5) * 1.8;
          ambient = 0;
        }

        pos.current.x += vel.current.x * dt;
        pos.current.y += vel.current.y * dt;

        if (pos.current.x < MARGIN) {
          pos.current.x = MARGIN;
          vel.current.x = Math.abs(vel.current.x) * WALL_BOUNCE;
        } else if (pos.current.x > w - MARGIN) {
          pos.current.x = w - MARGIN;
          vel.current.x = -Math.abs(vel.current.x) * WALL_BOUNCE;
        }
        if (pos.current.y < MARGIN) {
          pos.current.y = MARGIN;
          vel.current.y = Math.abs(vel.current.y) * WALL_BOUNCE;
        } else if (pos.current.y > h - MARGIN) {
          pos.current.y = h - MARGIN;
          vel.current.y = -Math.abs(vel.current.y) * WALL_BOUNCE;
        }

        vel.current.x *= DAMPING;
        vel.current.y *= DAMPING;

        if (moodRef.current === "dizzy" && now > dizzyUntil.current) {
          setMoodSafe("idle");
        }
      }

      const rot = clamp(vel.current.x * 3.2, -26, 26);
      el.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) translate(-50%, -50%) rotate(${rot}deg)`;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [reduced, containerRef, elRef, setMoodSafe]);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (reduced) return;
      const container = containerRef.current;
      const el = elRef.current;
      if (!container || !el) return;
      dragging.current = true;
      setMoodSafe("grab");
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      pos.current = { x, y };
      vel.current = { x: 0, y: 0 };
      drag.current = { x, y, t: performance.now() };
      el.setPointerCapture(e.pointerId);
    },
    [reduced, containerRef, elRef, setMoodSafe]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = performance.now();
      const dt = Math.max(8, now - drag.current.t);
      vel.current = {
        x: clamp(((x - drag.current.x) / dt) * 16, -MAX_VEL, MAX_VEL),
        y: clamp(((y - drag.current.y) / dt) * 16, -MAX_VEL, MAX_VEL),
      };
      pos.current = { x, y };
      drag.current = { x, y, t: now };
    },
    [containerRef]
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      dragging.current = false;
      const el = elRef.current;
      if (el && el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
      const speed = Math.hypot(vel.current.x, vel.current.y);
      if (speed > FLING_DIZZY_SPEED) {
        dizzyUntil.current = performance.now() + 1500;
        setMoodSafe("dizzy");
      } else {
        setMoodSafe("idle");
      }
    },
    [elRef, setMoodSafe]
  );

  const face =
    mood === "grab"
      ? FACE_GRAB
      : mood === "dizzy"
        ? FACE_DIZZY
        : faces[faceIdx] ?? faces[0] ?? "";

  return {
    face,
    grabbed: mood === "grab",
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
