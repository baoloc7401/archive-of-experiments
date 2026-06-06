import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import "./ExperimentCard.css";
import ScrambleText from "./ScrambleText";
import type { Experiment, ExperimentStatus } from "../experiments";

const STATUS_CLS: Record<ExperimentStatus, string> = {
  active: "status-active",
  wip: "status-wip",
  planned: "status-planned",
};

const SHOUT_COUNT = 7;

interface Props {
  experiment: Experiment;
  leaving?: boolean;
}

export default function ExperimentCard({ experiment, leaving = false }: Props) {
  const { t } = useTranslation();
  const { id, tags, status, path } = experiment;
  const ref = useRef<HTMLElement>(null);

  // Shout variant - initial random, re-rolls on every fresh hover.
  const [shoutIdx, setShoutIdx] = useState(() =>
    Math.floor(Math.random() * SHOUT_COUNT)
  );

  function rollShout() {
    setShoutIdx((prev) => {
      let next = Math.floor(Math.random() * SHOUT_COUNT);
      if (SHOUT_COUNT > 1 && next === prev) {
        next = (next + 1) % SHOUT_COUNT;
      }
      return next;
    });
  }

  // Cursor-tracked glow.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      el!.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      el!.style.setProperty("--my", `${e.clientY - rect.top}px`);
    }
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  const title = t(`experiments.${id}.title`);
  const description = t(`experiments.${id}.description`);
  const label = t(`status.${status}`);
  const isActive = status === "active";

  const cardStyle: CSSProperties = {
    viewTransitionName: `card-${id}`,
  };

  const cardClass = [
    "card",
    isActive ? "card-active" : "",
    leaving ? "is-leaving" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      ref={ref}
      className={cardClass}
      style={cardStyle}
      data-card-id={id}
      onMouseEnter={rollShout}
    >
      {isActive && !leaving && (
        <a href={import.meta.env.BASE_URL + path.replace(/^\//, "")} className="card-link" aria-label={title} />
      )}
      <div className="card-spot" aria-hidden="true" />
      <div className="card-glow" aria-hidden="true" />
      <div className="card-corner card-corner--tl" aria-hidden="true" />
      <div className="card-corner card-corner--br" aria-hidden="true" />

      <div className="card-header">
        <span className={`status-badge ${STATUS_CLS[status]}`}>
          {isActive && <span className="status-pulse" aria-hidden="true" />}
          <ScrambleText text={label} duration={600} />
        </span>
        {isActive && (
          <span className="card-arrow" aria-hidden="true">
            →
          </span>
        )}
      </div>

      <h2 className="card-title">
        <ScrambleText text={title} duration={600} />
      </h2>
      <p className="card-description">
        <ScrambleText text={description} duration={600} />
      </p>

      <div className="card-tags">
        {tags.map((tag) => (
          <span key={tag} className="tag">
            <ScrambleText text={t(`tags.${tag}`)} duration={600} />
          </span>
        ))}
      </div>

      <div className={`card-stop card-stop--${status}`} aria-hidden="true">
        <span className="card-stop-face">
          {t(`card_stop.${status}.${shoutIdx}.face`)}
        </span>
        <span className="card-stop-shout">
          {t(`card_stop.${status}.${shoutIdx}.shout`)}
        </span>
      </div>
    </article>
  );
}
