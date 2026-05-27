import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { experiments } from "./experiments";
import type { Experiment, ExperimentStatus } from "./experiments";
import ExperimentCard from "./components/ExperimentCard";
import ThemeToggle from "./components/ThemeToggle";
import LangToggle from "./components/LangToggle";
import ScrambleText from "./components/ScrambleText";
import FilterBar from "./components/FilterBar";
import type { StatusFilter } from "./components/FilterBar";
import { useTheme } from "./hooks/useTheme";
import "./App.css";

const STATUS_ORDER: Record<ExperimentStatus, number> = {
  active: 0,
  wip: 1,
  planned: 2,
};

const SIDEBAR_OPEN_KEY = "sidebar-open";
const SEARCH_DEBOUNCE_MS = 200;
const SUBTITLE_COUNT = 10;

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => unknown;
};

export default function App() {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const heroRef = useRef<HTMLElement>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem(SIDEBAR_OPEN_KEY);
    return saved == null ? true : saved === "1";
  });
  const [subtitleIdx, setSubtitleIdx] = useState(() =>
    Math.floor(Math.random() * SUBTITLE_COUNT)
  );
  // IDs of cards being snapped out; rendered with is-leaving so the
  // OLD view-transition snapshot picks up view-transition-class: leaving.
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());

  const ordered = useMemo(
    () =>
      [...experiments].sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      ),
    []
  );

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    experiments.forEach((e) => e.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, []);

  const statusCounts = useMemo<Record<StatusFilter, number>>(
    () => ({
      all: experiments.length,
      active: experiments.filter((e) => e.status === "active").length,
      wip: experiments.filter((e) => e.status === "wip").length,
      planned: experiments.filter((e) => e.status === "planned").length,
    }),
    []
  );

  // Filter helper — used both for the live render AND to predict what the
  // next state will produce, so we can mark removed cards before the snap.
  const computeFiltered = useCallback(
    (status: StatusFilter, tags: Set<string>, q: string): Experiment[] => {
      const needle = q.trim().toLowerCase();
      return ordered.filter((e) => {
        if (status !== "all" && e.status !== status) return false;
        if (tags.size > 0 && !e.tags.some((tag) => tags.has(tag))) return false;
        if (needle) {
          const title = t(`experiments.${e.id}.title`).toLowerCase();
          const desc = t(`experiments.${e.id}.description`).toLowerCase();
          const tagsHit = e.tags.some((tag) =>
            t(`tags.${tag}`).toLowerCase().includes(needle)
          );
          if (
            !title.includes(needle) &&
            !desc.includes(needle) &&
            !e.id.includes(needle) &&
            !tagsHit
          ) {
            return false;
          }
        }
        return true;
      });
    },
    [ordered, t]
  );

  const filtered = useMemo(
    () => computeFiltered(statusFilter, activeTags, search),
    [computeFiltered, statusFilter, activeTags, search]
  );

  // List that's actually rendered: filtered cards + leaving ghosts so the
  // snap animation has a real element to snapshot from.
  const rendered = useMemo(() => {
    if (leavingIds.size === 0) return filtered;
    const filteredIds = new Set(filtered.map((e) => e.id));
    const ghosts = ordered.filter(
      (e) => leavingIds.has(e.id) && !filteredIds.has(e.id)
    );
    return [...filtered, ...ghosts];
  }, [filtered, leavingIds, ordered]);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    activeTags.size +
    (searchInput.length > 0 ? 1 : 0);

  // Apply filter change. If cards are removed, snap them out:
  //   1. flushSync the leaving IDs so DOM renders them with is-leaving
  //      *before* the OLD view-transition snapshot is captured.
  //   2. startViewTransition: the snapshot picks up view-transition-class
  //      from CSS, then the callback flushSync's the real state update
  //      (which unmounts the leaving cards), then the new snapshot is
  //      captured. Browser animates: leaving cards get the snap, existing
  //      cards just slide.
  const snapAndUpdate = useCallback(
    (next: {
      status?: StatusFilter;
      tags?: Set<string>;
      search?: string;
    }) => {
      const nextStatus = next.status ?? statusFilter;
      const nextTags = next.tags ?? activeTags;
      const nextSearch = next.search ?? search;

      const nextFiltered = computeFiltered(nextStatus, nextTags, nextSearch);
      const nextIds = new Set(nextFiltered.map((e) => e.id));
      const removed = filtered
        .filter((e) => !nextIds.has(e.id))
        .map((e) => e.id);

      const apply = () => {
        if (next.status !== undefined) setStatusFilter(nextStatus);
        if (next.tags !== undefined) setActiveTags(nextTags);
        if (next.search !== undefined) setSearch(nextSearch);
      };

      const doc = document as DocWithVT;
      const canTx = typeof doc.startViewTransition === "function";

      if (removed.length === 0 || !canTx) {
        if (canTx) {
          doc.startViewTransition!(() => {
            flushSync(apply);
          });
        } else {
          apply();
        }
        return;
      }

      // Mark removed cards as leaving so the OLD snapshot has them with
      // view-transition-class: leaving. flushSync to commit the class
      // before startViewTransition takes its snapshot.
      flushSync(() => {
        setLeavingIds(new Set(removed));
      });

      doc.startViewTransition!(() => {
        flushSync(() => {
          apply();
          setLeavingIds(new Set());
        });
      });
    },
    [statusFilter, activeTags, search, filtered, computeFiltered]
  );

  // Debounce search → snap-and-update
  useEffect(() => {
    if (searchInput === search) return;
    const delay = searchInput === "" ? 0 : SEARCH_DEBOUNCE_MS;
    const handle = window.setTimeout(() => {
      snapAndUpdate({ search: searchInput });
    }, delay);
    return () => window.clearTimeout(handle);
  }, [searchInput, search, snapAndUpdate]);

  // Hero cursor tracking
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      el!.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      el!.style.setProperty("--my", `${e.clientY - rect.top}px`);
    }
    function onLeave() {
      el!.style.setProperty("--mx", `50%`);
      el!.style.setProperty("--my", `50%`);
    }
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // Scroll progress bar
  useEffect(() => {
    function update() {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? window.scrollY / max : 0);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const handleStatusChange = useCallback(
    (s: StatusFilter) => {
      snapAndUpdate({ status: s });
    },
    [snapAndUpdate]
  );

  const handleToggleTag = useCallback(
    (tag: string) => {
      const next = new Set(activeTags);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      snapAndUpdate({ tags: next });
    },
    [activeTags, snapAndUpdate]
  );

  const handleClearFilters = useCallback(() => {
    setSearchInput("");
    snapAndUpdate({
      status: "all",
      tags: new Set(),
      search: "",
    });
  }, [snapAndUpdate]);

  const rollSubtitle = useCallback(() => {
    setSubtitleIdx((prev) => {
      let next = Math.floor(Math.random() * SUBTITLE_COUNT);
      if (SUBTITLE_COUNT > 1 && next === prev) {
        next = (next + 1) % SUBTITLE_COUNT;
      }
      return next;
    });
  }, []);

  function toggleSidebar() {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_OPEN_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="root">
      <div className="noise" />
      <div
        className="scroll-progress"
        style={{ transform: `scaleX(${scrollProgress})` }}
        aria-hidden="true"
      />

      <header ref={heroRef} className="hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-spotlight" aria-hidden="true" />

        <div className="hero-top">
          <div className="hero-content">
            <div className="hero-prefix">
              <span className="hero-prefix-dot" aria-hidden="true" />
              <ScrambleText text={t("hero.prefix")} duration={600} />
            </div>
            <h1 className="hero-title">
              <ScrambleText text="archive" charDelay={45} />
              <span className="accent">
                <ScrambleText text="-of-" startDelay={350} charDelay={45} />
              </span>
              <ScrambleText
                text="experiments"
                startDelay={520}
                charDelay={45}
              />
              <span className="hero-cursor" aria-hidden="true">
                _
              </span>
            </h1>
            <button
              type="button"
              className="hero-sub"
              onClick={rollSubtitle}
              title="click for a new one"
            >
              <ScrambleText
                text={t(`hero.subtitle_${subtitleIdx}`)}
                duration={600}
              />
            </button>
          </div>
          <div className="hero-controls">
            <LangToggle />
            <ThemeToggle theme={theme} onToggle={toggle} />
          </div>
        </div>

        <div className="hero-bar" />
      </header>

      <main className="grid-section">
        <FilterBar
          open={sidebarOpen}
          onToggle={toggleSidebar}
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          activeTags={activeTags}
          onToggleTag={handleToggleTag}
          allTags={allTags}
          search={searchInput}
          onSearchChange={setSearchInput}
          statusCounts={statusCounts}
          activeFilterCount={activeFilterCount}
          onClearFilters={handleClearFilters}
        />

        <div className="grid-content">
          <div className="section-label">
            <span className="label-bracket" aria-hidden="true">
              //
            </span>
            <span className="label-text">
              <ScrambleText
                text={t("section.showing", {
                  count: filtered.length,
                  total: ordered.length,
                })}
                duration={600}
              />
            </span>
            <span className="label-line" />
          </div>

          {filtered.length === 0 && leavingIds.size === 0 ? (
            <div className="no-results">
              <div className="no-results-glyph" aria-hidden="true">
                ∅
              </div>
              <p className="no-results-text">
                <ScrambleText text={t("filter.no_results")} duration={600} />
              </p>
              <button
                type="button"
                className="no-results-clear"
                onClick={handleClearFilters}
              >
                <ScrambleText text={t("filter.reset")} duration={600} />
              </button>
            </div>
          ) : (
            <div className="card-grid">
              {rendered.map((exp) => (
                <ExperimentCard
                  key={exp.id}
                  experiment={exp}
                  leaving={leavingIds.has(exp.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <a
          href="https://github.com/baoloc7401/archive-of-experiments"
          target="_blank"
          rel="noreferrer"
        >
          <ScrambleText text={t("footer.github")} duration={600} />
        </a>
        <span className="footer-dot" aria-hidden="true">
          ·
        </span>
        <span>
          <ScrambleText text={t("footer.tagline")} duration={600} />
        </span>
      </footer>
    </div>
  );
}
