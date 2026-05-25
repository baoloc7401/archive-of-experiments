import { experiments } from "./experiments";
import ExperimentCard from "./components/ExperimentCard";
import "./App.css";

export default function App() {
  const active = experiments.filter((e) => e.status === "active");
  const wip = experiments.filter((e) => e.status === "wip");
  const planned = experiments.filter((e) => e.status === "planned");
  const ordered = [...active, ...wip, ...planned];

  return (
    <div className="root">
      <div className="noise" />

      <header className="hero">
        <div className="hero-prefix">baoloc7401 /</div>
        <h1 className="hero-title">
          archive<span className="accent">-of-</span>experiments
        </h1>
        <p className="hero-sub">
          A sandbox for algorithms, curiosity, and deliberate learning.
        </p>
        <div className="hero-bar" />
      </header>

      <main className="grid-section">
        <div className="section-label">
          <span className="label-line" />
          <span className="label-text">
            {ordered.length} experiment{ordered.length !== 1 ? "s" : ""}
          </span>
          <span className="label-line" />
        </div>

        <div className="card-grid">
          {ordered.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}
        </div>
      </main>

      <footer className="footer">
        <a
          href="https://github.com/baoloc7401/archive-of-experiments"
          target="_blank"
          rel="noreferrer"
        >
          github
        </a>
        <span className="footer-dot">·</span>
        <span>built to learn</span>
      </footer>
    </div>
  );
}
