import { experiments } from "./experiments";
import type { ExperimentStatus } from "./experiments";
import ExperimentCard from "./components/ExperimentCard";
import ThemeToggle from "./components/ThemeToggle";
import { useTheme } from "./hooks/useTheme";
import "./App.css";

const STATUS_ORDER: Record<ExperimentStatus, number> = { active: 0, wip: 1, planned: 2 };

export default function App() {
  const { theme, toggle } = useTheme();

  const ordered = [...experiments].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );

  return (
    <div className="root">
      <div className="noise" />

      <header className="hero">
        <div className="hero-top">
          <div className="hero-content">
            <div className="hero-prefix">baoloc7401 /</div>
            <h1 className="hero-title">
              archive<span className="accent">-of-</span>experiments
            </h1>
            <p className="hero-sub">
              A sandbox for algorithms, curiosity, and deliberate learning.
            </p>
          </div>
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
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
        <span className="footer-dot" aria-hidden="true">·</span>
        <span>built to learn</span>
      </footer>
    </div>
  );
}
