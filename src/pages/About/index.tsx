import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ExperimentLayout } from "../../components/ui";
import ScrambleText from "../../components/ScrambleText";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { experiments } from "../../experiments";
import { SITE } from "../../seo/site";
import AboutTerminal from "./AboutTerminal";
import type { TermBlock } from "./useAboutTerminal";
import {
  buildCommands,
  type PageRef,
  type PageTarget,
  type ReplStrings,
  type ThemeMode,
} from "./commands";
import "./About.css";

const APP_VERSION = __APP_VERSION__;

const PROMPT = "baoloc7401@archive:~$";

function flipTheme(): ThemeMode {
  const cur: ThemeMode =
    document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark";
  const next: ThemeMode = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  return next;
}

export default function About() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [replayKey, setReplayKey] = useState(0);

  // Cursor-tracked spotlight + grid parallax, à la the NotFound page. The glow
  // (--glow) fades in on enter and out on leave so it never sticks at the edge.
  useEffect(() => {
    if (reduced) return;
    const el = stageRef.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      const r = el!.getBoundingClientRect();
      el!.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el!.style.setProperty("--my", `${e.clientY - r.top}px`);
      el!.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      el!.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      // Any movement inside means the cursor is here - light the glow. (mouseenter
      // alone misses the case where the cursor was already over the stage on mount.)
      el!.style.setProperty("--glow", "1");
    }
    function onLeave() {
      el!.style.setProperty("--glow", "0");
    }
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [reduced]);

  // Boot script + stats line. Computed inline (cheap) so it always reflects the
  // current language; the terminal is remounted per language via its `key`.
  const stats = (() => {
    const tags = new Set<string>();
    experiments.forEach((e) => e.tags.forEach((tag) => tags.add(tag)));
    return {
      total: experiments.length,
      live: experiments.filter((e) => e.status === "active").length,
      planned: experiments.filter((e) => e.status === "planned").length,
      tags: tags.size,
    };
  })();

  const statsLine =
    `${stats.total} ${t("about.stats.total")} · ` +
    `${stats.live} ${t("about.stats.live")} · ` +
    `${stats.planned} ${t("about.stats.planned")} · ` +
    `${stats.tags} ${t("about.stats.tags")}`;

  const principles = t("about.principles.items", {
    returnObjects: true,
  }) as string[];

  const script: TermBlock[] = [
    { cmd: "whoami", out: [t("about.term.whoami")] },
    {
      cmd: "cat about.txt",
      out: t("about.term.about", { returnObjects: true }) as string[],
    },
    { cmd: "ls experiments/ --status", out: [statsLine] },
    {
      cmd: "cat why.md",
      out: t("about.term.why", { returnObjects: true }) as string[],
    },
    { cmd: "cat principles.md", out: principles.map((p) => `// ${p}`) },
    { cmd: "uname --stack", out: [t("about.term.stack")] },
  ];

  // Interactive prompt: `ls` renders these experiments as clickable cards, and
  // `open` targets are those plus the site's standalone pages. Command strings
  // are resolved here and handed to the (framework-free) command engine.
  const expRefs: PageRef[] = experiments
    .filter((e) => e.status === "active")
    .map((e) => ({
      kind: "page" as const,
      key: e.id,
      path: e.path,
      title: t(`experiments.${e.id}.title`),
      desc: t(`experiments.${e.id}.description`),
      tags: e.tags.map((tag) => t(`tags.${tag}`)),
    }));

  const pages: PageTarget[] = [
    ...expRefs.map((r) => ({ key: r.key, path: r.path, label: r.title })),
    { key: "home", path: "/", label: t("about.term.repl.nav.home") },
    { key: "about", path: "/about", label: t("about.term.repl.nav.about") },
    { key: "contact", path: "/contact", label: t("about.term.repl.nav.contact") },
  ];

  const replStrings: ReplStrings = {
    helpTitle: t("about.term.repl.help_title"),
    notFound: (cmd) => t("about.term.repl.not_found", { cmd }),
    openUsage: t("about.term.repl.open_usage"),
    openUnknown: (arg) => t("about.term.repl.open_unknown", { arg }),
    opening: (label) => t("about.term.repl.opening", { label }),
    themeNow: (mode) => t("about.term.repl.theme_now", { mode }),
    modeLabel: {
      dark: t("about.term.repl.mode_dark"),
      light: t("about.term.repl.mode_light"),
    },
    version: (v) => t("about.term.repl.version", { v }),
    sudo: t("about.term.repl.sudo"),
    desc: t("about.term.repl.desc", { returnObjects: true }) as Record<
      string,
      string
    >,
    whoami: t("about.term.whoami"),
    about: t("about.term.about", { returnObjects: true }) as string[],
    why: t("about.term.why", { returnObjects: true }) as string[],
    principles,
    stack: t("about.term.stack"),
    statsLine,
    lsTitle: t("about.term.repl.ls_title"),
    lsNav: t("about.term.repl.ls_nav"),
  };

  const commands = buildCommands({
    s: replStrings,
    pages,
    experiments: expRefs,
    version: APP_VERSION,
    navigate,
    toggleTheme: flipTheme,
  });

  return (
    <ExperimentLayout crumbs={[{ label: t("about.crumb") }]} glow="accent2">
      <div
        ref={stageRef}
        className={`about${reduced ? " about--still" : ""}`}
      >
        <div className="about-grid" aria-hidden="true" />
        <div className="about-spotlight" aria-hidden="true" />

        <div className="about-head">
          <p className="about-eyebrow">
            <span className="about-eyebrow-dot" aria-hidden="true" />
            <ScrambleText text={t("about.tagline")} duration={600} />
          </p>
          <h1 className="about-title">
            <ScrambleText text={t("about.title")} duration={700} />
          </h1>
        </div>

        <AboutTerminal
          key={`${replayKey}-${i18n.language}`}
          script={script}
          prompt={PROMPT}
          version={APP_VERSION}
          boot={t("about.term.boot", {
            total: stats.total,
            live: stats.live,
          })}
          ready={t("about.term.ready")}
          hint={t("about.term.repl.hint")}
          inputAria={t("about.term.repl.aria")}
          labels={{ replay: t("about.term.replay"), skip: t("about.term.skip") }}
          commands={commands}
          pages={pages}
          notFound={replStrings.notFound}
          reduced={reduced}
          onOpen={(path) => navigate(path)}
          onReplay={() => setReplayKey((k) => k + 1)}
        />

        <div className="about-cta">
          <Link to="/" className="about-cta-link about-cta-link--primary">
            <span className="about-cta-arrow" aria-hidden="true">
              →
            </span>
            <ScrambleText text={t("about.cta.explore")} duration={650} />
          </Link>
          <a
            href={`${SITE.authorUrl}/archive-of-experiments`}
            target="_blank"
            rel="noreferrer"
            className="about-cta-link"
          >
            <span className="about-cta-arrow" aria-hidden="true">
              ↗
            </span>
            <ScrambleText text={t("about.cta.source")} duration={650} />
          </a>
          <Link to="/contact" className="about-cta-link">
            <span className="about-cta-arrow" aria-hidden="true">
              →
            </span>
            <ScrambleText text={t("about.cta.contact")} duration={650} />
          </Link>
        </div>
      </div>
    </ExperimentLayout>
  );
}
