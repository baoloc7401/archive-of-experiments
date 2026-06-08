// Framework-free command engine for the About terminal's interactive prompt.
// Pure given its context: command definitions, suggestion (intellisense), and
// line execution. Side effects (navigation, theme) are injected as callbacks.

import { renderPagespeed } from "./pagespeed";

export type ArgKind = "page" | "theme" | "text";
export type ThemeMode = "dark" | "light";

export interface PageTarget {
  /** Token typed after `open`, e.g. "chess" or "contact". */
  key: string;
  path: string;
  label: string;
}

export interface Suggestion {
  label: string;
  hint: string;
  /** The full input line this suggestion completes to. */
  value: string;
}

/** A clickable experiment reference emitted by `ls` (renders a card tooltip). */
export interface PageRef {
  kind: "page";
  key: string;
  path: string;
  title: string;
  desc: string;
  tags: string[];
}

/** A scored bar emitted by `pagespeed` (label + 0-100 bar + readout). */
export interface Gauge {
  kind: "gauge";
  label: string;
  /** 0-100, drives the bar length and colour band. */
  score: number;
  /** Readout at the end of the row, e.g. "96" or "1.6 s". */
  value: string;
}

/** Translatable labels for the `pagespeed` gauge view. */
export interface PagespeedLabels {
  caption: string;
  mobile: string;
  desktop: string;
  metrics: string;
}

/** A line of terminal output: plain text, a clickable page, or a scored bar. */
export type OutLine = string | PageRef | Gauge;

export interface ReplStrings {
  helpTitle: string;
  notFound: (cmd: string) => string;
  openUsage: string;
  openUnknown: (arg: string) => string;
  opening: (label: string) => string;
  themeNow: (mode: string) => string;
  modeLabel: Record<ThemeMode, string>;
  version: (v: string) => string;
  sudo: string;
  desc: Record<string, string>;
  whoami: string;
  about: string[];
  why: string[];
  principles: string[];
  stack: string;
  statsLine: string;
  lsTitle: string;
  lsNav: string;
  pagespeed: PagespeedLabels;
}

export interface CommandCtx {
  s: ReplStrings;
  /** `open`/intellisense targets (experiments + standalone pages). */
  pages: PageTarget[];
  /** Rich experiment list rendered by `ls` (clickable cards). */
  experiments: PageRef[];
  version: string;
  navigate: (path: string) => void;
  toggleTheme: () => ThemeMode;
}

export interface Command {
  name: string;
  desc: string;
  arg?: ArgKind;
  /** Hidden from help and intellisense (easter eggs). */
  hidden?: boolean;
  run: (args: string[]) => OutLine[] | void;
}

const MAX_SUGGESTIONS = 6;

function pad(str: string, n: number): string {
  return str + " ".repeat(Math.max(1, n - str.length));
}

function currentTheme(): ThemeMode {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

export function buildCommands(ctx: CommandCtx): Command[] {
  const { s } = ctx;
  const list: Command[] = [];

  const helpRun = (): OutLine[] => {
    const visible = list.filter((c) => !c.hidden);
    const width = Math.max(...visible.map((c) => c.name.length)) + 2;
    return [s.helpTitle, ...visible.map((c) => `  ${pad(c.name, width)}${c.desc}`)];
  };

  const lsRun = (): OutLine[] => [
    s.lsTitle,
    ...ctx.experiments,
    `  ${s.lsNav}`,
  ];

  const openRun = (args: string[]): OutLine[] => {
    const arg = (args[0] ?? "").toLowerCase();
    if (!arg) return [s.openUsage];
    const target = ctx.pages.find((p) => p.key === arg);
    if (!target) return [s.openUnknown(arg)];
    ctx.navigate(target.path);
    return [s.opening(target.label)];
  };

  const themeRun = (args: string[]): OutLine[] => {
    const want = (args[0] ?? "").toLowerCase();
    if (want === "dark" || want === "light") {
      if (want === currentTheme()) return [s.themeNow(s.modeLabel[want])];
    }
    const mode = ctx.toggleTheme();
    return [s.themeNow(s.modeLabel[mode])];
  };

  const def = (
    name: string,
    run: Command["run"],
    extra?: Partial<Command>
  ): Command => ({ name, desc: s.desc[name] ?? "", run, ...extra });

  list.push(
    def("help", helpRun),
    def("whoami", () => [s.whoami]),
    def("about", () => s.about),
    def("why", () => s.why),
    def("principles", () => s.principles.map((p) => `// ${p}`)),
    def("stack", () => [s.stack]),
    def("stats", () => [s.statsLine]),
    def("pagespeed", () => renderPagespeed(s.pagespeed)),
    def("version", () => [s.version(ctx.version)]),
    def("ls", lsRun),
    def("open", openRun, { arg: "page" }),
    def("theme", themeRun, { arg: "theme" }),
    def("echo", (args) => [args.join(" ")], { arg: "text" }),
    def("clear", () => {}),
    def("sudo", () => [s.sudo], { arg: "text", hidden: true })
  );

  return list;
}

/** Intellisense for the current input: commands, then per-command arguments. */
export function suggest(
  input: string,
  commands: Command[],
  pages: PageTarget[]
): Suggestion[] {
  if (input.trim() === "") return [];

  const endsWithSpace = /\s$/.test(input);
  const parts = input.trimStart().split(/\s+/);
  const visible = commands.filter((c) => !c.hidden);

  // First token, still being typed → complete the command name.
  if (parts.length === 1 && !endsWithSpace) {
    const q = parts[0].toLowerCase();
    return visible
      .filter((c) => c.name.startsWith(q) && c.name !== q)
      .slice(0, MAX_SUGGESTIONS)
      .map((c) => ({
        label: c.name,
        hint: c.desc,
        value: c.arg ? `${c.name} ` : c.name,
      }));
  }

  // Completing an argument for a known command.
  const cmd = commands.find((c) => c.name === parts[0].toLowerCase());
  if (!cmd || !cmd.arg) return [];
  const token = endsWithSpace ? "" : parts[parts.length - 1].toLowerCase();

  if (cmd.arg === "page") {
    return pages
      .filter((p) => p.key.startsWith(token) && p.key !== token)
      .slice(0, MAX_SUGGESTIONS)
      .map((p) => ({ label: p.key, hint: p.label, value: `${cmd.name} ${p.key}` }));
  }

  if (cmd.arg === "theme") {
    return (["dark", "light"] as const)
      .filter((m) => m.startsWith(token) && m !== token)
      .map((m) => ({ label: m, hint: "", value: `${cmd.name} ${m}` }));
  }

  return [];
}

/** Run a typed line. Returns the output lines (possibly empty). */
export function runLine(
  input: string,
  commands: Command[],
  notFound: (cmd: string) => string
): OutLine[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const [name, ...args] = trimmed.split(/\s+/);
  const cmd = commands.find((c) => c.name === name.toLowerCase());
  if (!cmd) return [notFound(name)];
  return cmd.run(args) ?? [];
}
