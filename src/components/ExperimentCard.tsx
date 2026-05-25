import { useTranslation } from "react-i18next";
import "./ExperimentCard.css";
import type { Experiment, ExperimentStatus } from "../experiments";

const STATUS_CLS: Record<ExperimentStatus, string> = {
  active: "status-active",
  wip: "status-wip",
  planned: "status-planned",
};

interface Props {
  experiment: Experiment;
}

export default function ExperimentCard({ experiment }: Props) {
  const { t } = useTranslation();
  const { id, tags, status, path } = experiment;

  const title = t(`experiments.${id}.title`);
  const description = t(`experiments.${id}.description`);
  const label = t(`status.${status}`);

  return (
    <article className={`card${status === "active" ? " card-active" : ""}`}>
      {status === "active" && (
        <a href={path} className="card-link" aria-label={title} />
      )}
      <div className="card-glow" />
      <div className="card-header">
        <span className={`status-badge ${STATUS_CLS[status]}`}>{label}</span>
      </div>
      <h2 className="card-title">{title}</h2>
      <p className="card-description">{description}</p>
      <div className="card-tags">
        {tags.map((tag) => (
          <span key={tag} className="tag">
            {t(`tags.${tag}`)}
          </span>
        ))}
      </div>
    </article>
  );
}
