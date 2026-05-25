import type { Experiment, ExperimentStatus } from "../experiments";

const STATUS_LABEL: Record<ExperimentStatus, string> = {
  active: "LIVE",
  wip: "WIP",
  planned: "PLANNED",
};

const STATUS_CLASS: Record<ExperimentStatus, string> = {
  active: "status-active",
  wip: "status-wip",
  planned: "status-planned",
};

interface Props {
  experiment: Experiment;
}

export default function ExperimentCard({ experiment }: Props) {
  const { title, description, tags, status, path } = experiment;
  const isClickable = status === "active";

  const inner = (
    <div className={`card ${isClickable ? "card-clickable" : "card-inert"}`}>
      <div className="card-header">
        <span className={`status-badge ${STATUS_CLASS[status]}`}>
          {STATUS_LABEL[status]}
        </span>
        <div className="card-glow" />
      </div>
      <h3 className="card-title">{title}</h3>
      <p className="card-description">{description}</p>
      <div className="card-tags">
        {tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );

  return isClickable ? <a href={path}>{inner}</a> : inner;
}
