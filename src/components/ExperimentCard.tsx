import type { Experiment, ExperimentStatus } from "../experiments";

const STATUS: Record<ExperimentStatus, { label: string; cls: string }> = {
  active:  { label: "LIVE",    cls: "status-active"  },
  wip:     { label: "WIP",     cls: "status-wip"     },
  planned: { label: "PLANNED", cls: "status-planned" },
};

interface Props {
  experiment: Experiment;
}

export default function ExperimentCard({ experiment }: Props) {
  const { title, description, tags, status, path } = experiment;
  const { label, cls } = STATUS[status];

  return (
    <article className={`card${status === "active" ? " card-active" : ""}`}>
      {status === "active" && (
        <a href={path} className="card-link" aria-label={title} />
      )}
      <div className="card-glow" />
      <div className="card-header">
        <span className={`status-badge ${cls}`}>{label}</span>
      </div>
      <h2 className="card-title">{title}</h2>
      <p className="card-description">{description}</p>
      <div className="card-tags">
        {tags.map((tag) => (
          <span key={tag} className="tag">{tag}</span>
        ))}
      </div>
    </article>
  );
}
