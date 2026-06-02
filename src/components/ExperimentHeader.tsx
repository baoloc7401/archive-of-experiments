import { Fragment, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import LangToggle from "./LangToggle";
import ThemeToggle from "./ThemeToggle";
import ScrambleText from "./ScrambleText";
import { useTheme } from "../hooks/useTheme";
import "./ExperimentHeader.css";

export type Crumb = {
  label: string;
  /** Where this crumb navigates. Omit (or point at the current path) for a
   *  non-navigating "you're already here" crumb. */
  to?: string;
};

interface Props {
  crumbs: Crumb[];
}

export default function ExperimentHeader({ crumbs }: Props) {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);
  const hintTimer = useRef<number | null>(null);
  const hintIdx = useRef(0);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      el!.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      el!.style.setProperty("--my", `${e.clientY - rect.top}px`);
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(
    () => () => {
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
    },
    []
  );

  function onCrumbClick(e: React.MouseEvent, to: string) {
    e.preventDefault();
    // A crumb that points elsewhere navigates; the one naming the current page winks.
    if (to !== location.pathname) {
      navigate(to);
      return;
    }
    const hints = t("header.already_here", { returnObjects: true }) as string[];
    setHint(hints[hintIdx.current % hints.length]);
    hintIdx.current += 1;
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 2400);
  }

  function onBackClick(e: React.MouseEvent) {
    e.preventDefault();
    navigate("/");
  }

  return (
    <header ref={headerRef} className="exp-topbar">
      <div className="exp-topbar-spotlight" aria-hidden="true" />
      <a href={import.meta.env.BASE_URL} className="exp-back" onClick={onBackClick}>
        <ScrambleText text={t("header.back")} duration={600} />
      </a>
      <div className="exp-topbar-title">
        {crumbs.map((c, i) => {
          const to = c.to ?? location.pathname;
          return (
            <Fragment key={c.label}>
              {i > 0 && (
                <span className="exp-topbar-sep" aria-hidden="true">
                  /
                </span>
              )}
              <a
                href={to}
                className={i === 0 ? "exp-topbar-main" : "exp-topbar-sub"}
                onClick={(e) => onCrumbClick(e, to)}
              >
                <ScrambleText text={c.label} duration={600} />
              </a>
            </Fragment>
          );
        })}
        {hint && (
          <span className="exp-topbar-hint" role="status">
            {hint}
          </span>
        )}
      </div>
      <div className="exp-topbar-controls">
        <LangToggle />
        <ThemeToggle theme={theme} onToggle={toggle} />
      </div>
    </header>
  );
}
