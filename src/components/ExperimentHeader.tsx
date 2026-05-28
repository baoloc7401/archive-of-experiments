import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import LangToggle from "./LangToggle";
import ThemeToggle from "./ThemeToggle";
import ScrambleText from "./ScrambleText";
import { useTheme } from "../hooks/useTheme";
import "./ExperimentHeader.css";

interface Props {
  title: string;
  subtitle?: string;
}

export default function ExperimentHeader({ title, subtitle }: Props) {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const headerRef = useRef<HTMLElement>(null);

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

  return (
    <header ref={headerRef} className="exp-topbar">
      <div className="exp-topbar-spotlight" aria-hidden="true" />
      <a href={import.meta.env.BASE_URL} className="exp-back">
        <ScrambleText text={t("header.back")} duration={600} />
      </a>
      <div className="exp-topbar-title">
        <span className="exp-topbar-main">
          <ScrambleText text={title} duration={600} />
        </span>
        {subtitle && (
          <span className="exp-topbar-sub">
            /{" "}
            <ScrambleText text={subtitle} duration={600} />
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
