import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "../ThemeToggle";
import LangToggle from "../LangToggle";
import ScrambleText from "../ScrambleText";
import { Tooltip } from "../ui";
import { experiments } from "@/experiments";
import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useMascotPhysics } from "./useMascotPhysics";
import { useTypingTerminal } from "./useTypingTerminal";
import "./NotFound.css";

// Floating "lost code" debris. Built once at module load so the layout is
// stable across renders (no impure Math.random in the render path).
type Debris = {
  char: string;
  left: number;
  delay: number;
  dur: number;
  size: number;
  drift: number;
};

const DEBRIS_GLYPHS = [
  "{",
  "}",
  ";",
  "/>",
  "404",
  "null",
  "NaN",
  "undefined",
  "</>",
  "&&",
  "??",
  "0x1A4",
  "void",
  "()",
  "/*",
  "*/",
  "::",
  "=>",
];

const DEBRIS: Debris[] = Array.from({ length: 22 }, (_, i) => ({
  char: DEBRIS_GLYPHS[i % DEBRIS_GLYPHS.length],
  left: Math.random() * 100,
  delay: -Math.random() * 14,
  dur: 9 + Math.random() * 11,
  size: 0.7 + Math.random() * 0.9,
  drift: (Math.random() - 0.5) * 80,
}));

const DIGITS = ["4", "0", "4"] as const;
const SHAKE_REVERSALS = 5;
const SHAKE_WINDOW_MS = 450;
const SHAKE_HOLD_MS = 700;

function lostTier(secs: number): number {
  if (secs < 6) return 0;
  if (secs < 16) return 1;
  if (secs < 31) return 2;
  return 3;
}

export default function NotFound() {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);

  const lines = t("notfound.lines", { returnObjects: true }) as string[];
  const faces = t("notfound.faces", { returnObjects: true }) as string[];

  const [lineIdx, setLineIdx] = useState(() =>
    Math.floor(Math.random() * lines.length)
  );
  const [secs, setSecs] = useState(0);
  const [pct, setPct] = useState(4);
  const [shaking, setShaking] = useState(false);

  const mascot = useMascotPhysics(rootRef, mascotRef, faces, reduced);
  const term = useTypingTerminal(reduced);

  // "Lost for N seconds" counter.
  useEffect(() => {
    const id = window.setInterval(() => setSecs((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Fake recovery bar: crawls to 99%, gives up, starts over. Forever.
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setPct((p) => {
        if (p >= 99) return 4;
        const inc = p < 78 ? 4 + Math.random() * 7 : 0.5;
        return Math.min(99, Math.round(p + inc));
      });
    }, 300);
    return () => window.clearInterval(id);
  }, [reduced]);

  // Cursor parallax (feeds CSS vars) + shake detection (rapid direction
  // reversals rattle the 404).
  useEffect(() => {
    if (reduced) return;
    const el = rootRef.current;
    if (!el) return;
    const sk = { lastX: 0, dir: 0, count: 0, t: 0 };
    let clearTimer = 0;

    function onMove(e: MouseEvent) {
      const r = el!.getBoundingClientRect();
      el!.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      el!.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      el!.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el!.style.setProperty("--my", `${e.clientY - r.top}px`);

      const dx = e.clientX - sk.lastX;
      sk.lastX = e.clientX;
      const dir = dx > 4 ? 1 : dx < -4 ? -1 : 0;
      if (dir !== 0) {
        const now = performance.now();
        if (sk.dir !== 0 && dir !== sk.dir) {
          sk.count = now - sk.t < SHAKE_WINDOW_MS ? sk.count + 1 : 1;
          sk.t = now;
          if (sk.count >= SHAKE_REVERSALS) {
            sk.count = 0;
            setShaking(true);
            window.clearTimeout(clearTimer);
            clearTimer = window.setTimeout(() => setShaking(false), SHAKE_HOLD_MS);
          }
        }
        sk.dir = dir;
      }
    }

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.clearTimeout(clearTimer);
    };
  }, [reduced]);

  const rollLine = useCallback(() => {
    setLineIdx((prev) => {
      if (lines.length < 2) return prev;
      let next = Math.floor(Math.random() * lines.length);
      if (next === prev) next = (next + 1) % lines.length;
      return next;
    });
  }, [lines.length]);

  // Knock a digit loose imperatively: a scripted animation overrides the CSS
  // bob while it tumbles, then bob resumes on its own. Avoids the cascade fight
  // between the bob keyframes and any per-digit override.
  const knockDigit = useCallback(
    (el: HTMLElement) => {
      if (reduced) return;
      el.getAnimations().forEach((a) => {
        if (a.id === "nf-knock") a.cancel();
      });
      el.animate(
        [
          { transform: "translateY(0) rotate(0deg)" },
          { transform: "translateY(130px) rotate(42deg)", offset: 0.28 },
          { transform: "translateY(54px) rotate(-22deg)", offset: 0.55 },
          { transform: "translateY(74px) rotate(10deg)", offset: 0.78 },
          { transform: "translateY(0) rotate(0deg)" },
        ],
        { duration: 900, easing: "cubic-bezier(0.22, 1, 0.36, 1)", id: "nf-knock" }
      );
    },
    [reduced]
  );

  const feelLucky = useCallback(() => {
    const live = experiments.filter((e) => e.status === "active");
    if (live.length === 0) {
      navigate("/");
      return;
    }
    const pick = live[Math.floor(Math.random() * live.length)];
    navigate(pick.path);
  }, [navigate]);

  return (
    <div
      ref={rootRef}
      className={`nf${reduced ? " nf--still" : ""}`}
    >
      <div className="nf-grid" aria-hidden="true" />
      <div className="nf-spotlight" aria-hidden="true" />
      <div className="nf-scan" aria-hidden="true" />

      {!reduced && (
        <div className="nf-debris" aria-hidden="true">
          {DEBRIS.map((d, i) => (
            <span
              key={i}
              className="nf-debris-bit"
              style={
                {
                  left: `${d.left}%`,
                  fontSize: `${d.size}rem`,
                  animationDelay: `${d.delay}s`,
                  animationDuration: `${d.dur}s`,
                  "--drift": `${d.drift}px`,
                } as CSSProperties
              }
            >
              {d.char}
            </span>
          ))}
        </div>
      )}

      {!reduced && (
        <div
          ref={mascotRef}
          className={`nf-mascot${mascot.grabbed ? " nf-mascot--grabbed" : ""}`}
          aria-hidden="true"
          onPointerDown={mascot.onPointerDown}
          onPointerMove={mascot.onPointerMove}
          onPointerUp={mascot.onPointerUp}
          onPointerCancel={mascot.onPointerUp}
        >
          {mascot.face}
        </div>
      )}

      <div className="nf-controls">
        <LangToggle />
        <ThemeToggle theme={theme} onToggle={toggle} />
      </div>

      <main className="nf-stage">
        <div
          className={`nf-404${shaking ? " nf-404--shaking" : ""}`}
          role="img"
          aria-label="404"
        >
          {DIGITS.map((d, i) => (
            <span
              key={i}
              className={`nf-digit${i === 1 ? " nf-digit--o" : ""}`}
              data-d={d}
              aria-hidden="true"
              onClick={(e) => knockDigit(e.currentTarget)}
            >
              {i === 1 && <span className="nf-orbit" aria-hidden="true" />}
              {d}
            </span>
          ))}
        </div>

        {reduced && (
          <div className="nf-mascot nf-mascot--still" aria-hidden="true">
            {faces[0]}
          </div>
        )}

        <h1 className="nf-heading">
          <ScrambleText text={t("notfound.heading")} duration={700} />
        </h1>

        <Tooltip label={t("notfound.reroll_hint")}>
          <button type="button" className="nf-excuse" onClick={rollLine}>
            <ScrambleText text={lines[lineIdx]} duration={650} />
          </button>
        </Tooltip>

        <p className="nf-lost" role="status">
          {t(`notfound.lost.${lostTier(secs)}`, { n: secs })}
        </p>

        <pre className="nf-terminal" aria-hidden="true">
          <span className="nf-term-cmd">
            {term.cmd}
            {term.typing && <span className="nf-caret">_</span>}
          </span>
          <span className="nf-term-out">
            {term.showOut ? term.out : " "}
            {term.showOut && <span className="nf-caret">_</span>}
          </span>
        </pre>

        <div className="nf-loader" aria-hidden="true">
          <div className="nf-loader-track">
            <div className="nf-loader-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="nf-loader-label">
            <ScrambleText text={t("notfound.loading")} duration={650} />
            <span className="nf-loader-pct">{pct}%</span>
          </div>
        </div>

        <div className="nf-actions">
          <Tooltip label={t("notfound.lucky_hint")}>
            <button type="button" className="nf-action nf-action--lucky" onClick={feelLucky}>
              <span className="nf-action-icon" aria-hidden="true">
                ✦
              </span>
              <ScrambleText text={t("notfound.lucky")} duration={650} />
            </button>
          </Tooltip>
          <Link to="/" className="nf-action nf-action--home">
            <span className="nf-action-arrow" aria-hidden="true">
              ←
            </span>
            <ScrambleText text={t("notfound.go_home")} duration={650} />
          </Link>
        </div>
      </main>
    </div>
  );
}
