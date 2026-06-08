import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import ScrambleText from "../../components/ScrambleText";
import { useAboutTerminal, type TermBlock } from "./useAboutTerminal";
import {
  runLine,
  suggest,
  type Command,
  type Gauge,
  type OutLine,
  type PageRef,
  type PageTarget,
  type Suggestion,
} from "./commands";

interface Props {
  script: TermBlock[];
  prompt: string;
  version: string;
  boot: string;
  ready: string;
  hint: string;
  inputAria: string;
  labels: { replay: string; skip: string };
  commands: Command[];
  pages: PageTarget[];
  notFound: (cmd: string) => string;
  reduced: boolean;
  onOpen: (path: string) => void;
  onReplay: () => void;
}

interface Entry {
  cmd: string;
  out: OutLine[];
}

const CONFETTI_MS = 760;
const CONFETTI_GLYPHS = ["✦", "★", "◆", "+", "{}", ";", "//", "❯", "✧", "·"];

// Precomputed particle burst (no Math.random in render): each bit fans out from
// the version chip on a fixed angle, biased upward, then arcs away and fades.
const CONFETTI = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + (i % 2 ? 0.35 : -0.25);
  const dist = 42 + ((i * 11) % 26);
  return {
    char: CONFETTI_GLYPHS[i % CONFETTI_GLYPHS.length],
    dx: Math.round(Math.cos(angle) * dist),
    dy: Math.round(Math.sin(angle) * dist) - 16,
    rot: (i % 2 ? 1 : -1) * (110 + ((i * 37) % 200)),
    delay: (i % 4) * 16,
  };
});

const Prompt = ({ text }: { text: string }) => (
  <span className="about-term-prompt" aria-hidden="true">
    {text}
  </span>
);

const Cursor = ({ idle = false }: { idle?: boolean }) => (
  <span
    className={idle ? "about-cursor about-cursor--idle" : "about-cursor"}
    aria-hidden="true"
  />
);

function outClass(line: string): string {
  if (line.startsWith("//")) return "about-term-out about-term-out--note";
  if (line.startsWith("  ")) return "about-term-out about-term-out--list";
  return "about-term-out";
}

/** A scored bar (from `pagespeed`): label, a filled track, and the readout.
 *  Colour bands follow Lighthouse - green >= 90, amber >= 50, else red. */
function GaugeRow({ gauge }: { gauge: Gauge }) {
  const band =
    gauge.score >= 90 ? "good" : gauge.score >= 50 ? "average" : "poor";
  return (
    <div className={`about-gauge about-gauge--${band}`}>
      <span className="about-gauge-label">{gauge.label}</span>
      <span className="about-gauge-track" aria-hidden="true">
        <span
          className="about-gauge-fill"
          style={{ width: `${gauge.score}%` }}
        />
      </span>
      <span className="about-gauge-val">{gauge.value}</span>
    </div>
  );
}

/** A clickable experiment row (from `ls`) - click to open the experiment. */
function PageRow({
  page,
  onOpen,
}: {
  page: PageRef;
  onOpen: (path: string) => void;
}) {
  return (
    <button
      type="button"
      className="about-term-page"
      onClick={() => onOpen(page.path)}
    >
      <span className="about-term-page-mark" aria-hidden="true">
        ›
      </span>
      <span className="about-term-page-key">{page.key}</span>
      <span className="about-term-page-title">{page.title}</span>
      <span className="about-term-page-go" aria-hidden="true">
        open ↗
      </span>
    </button>
  );
}

function TermLines({
  cmd,
  out,
  prompt,
  onOpen,
  fresh = false,
}: {
  cmd: string;
  out: OutLine[];
  prompt: string;
  onOpen: (path: string) => void;
  fresh?: boolean;
}) {
  return (
    <div className={fresh ? "about-term-block about-term-block--new" : "about-term-block"}>
      <div className="about-term-cmdline">
        <Prompt text={prompt} />
        <span className="about-term-cmd">{cmd}</span>
      </div>
      {out.map((line, j) => {
        if (typeof line === "string")
          return (
            <div key={j} className={outClass(line)}>
              {line}
            </div>
          );
        if (line.kind === "gauge") return <GaugeRow key={j} gauge={line} />;
        return <PageRow key={j} page={line} onOpen={onOpen} />;
      })}
    </div>
  );
}

/**
 * Terminal window: types the boot sequence (via {@link useAboutTerminal}), then
 * hands the prompt over to the visitor - a live input with command intellisense,
 * history, and real actions (`open`, `theme`, `clear`, `version`). Command logic
 * lives in commands.ts; this component is the I/O surface.
 */
export default function AboutTerminal({
  script,
  prompt,
  version,
  boot,
  ready,
  hint,
  inputAria,
  labels,
  commands,
  pages,
  notFound,
  reduced,
  onOpen,
  onReplay,
}: Props) {
  const [skipped, setSkipped] = useState(false);
  const { rendered, finished } = useAboutTerminal(script, reduced || skipped);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [sel, setSel] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [pop, setPop] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLPreElement>(null);
  const popTimer = useRef<number | null>(null);
  const listId = useId();

  const suggestions = suggest(input, commands, pages);
  const showSuggest = focused && !dismissed && suggestions.length > 0;
  const selClamped = Math.min(sel, suggestions.length - 1);

  useEffect(() => {
    if (finished && !reduced) inputRef.current?.focus();
  }, [finished, reduced]);

  // Keep the view pinned to the newest line as output streams in.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, rendered, finished]);

  useEffect(
    () => () => {
      if (popTimer.current) window.clearTimeout(popTimer.current);
    },
    []
  );

  function popConfetti() {
    if (reduced) return;
    setPop((p) => p + 1);
    if (popTimer.current) window.clearTimeout(popTimer.current);
    popTimer.current = window.setTimeout(() => setPop(0), CONFETTI_MS);
  }

  function exec(value: string) {
    const trimmed = value.trim();
    const name = trimmed.split(/\s+/)[0]?.toLowerCase() ?? "";
    if (trimmed) {
      setHistory((h) => (h[h.length - 1] === value ? h : [...h, value]));
    }
    setHistIdx(null);
    if (name === "clear") {
      setEntries([]);
      return;
    }
    const out = runLine(value, commands, notFound);
    setEntries((prev) => [...prev, { cmd: value, out }]);
  }

  function submit() {
    const value = input;
    setInput("");
    setSel(0);
    setDismissed(false);
    exec(value);
  }

  function runVersion() {
    exec("version");
    popConfetti();
    inputRef.current?.focus();
  }

  function accept(sg: Suggestion) {
    setInput(sg.value);
    setSel(0);
    setDismissed(false);
    setHistIdx(null);
    inputRef.current?.focus();
  }

  function recallHistory(dir: -1 | 1) {
    if (history.length === 0) return;
    const cur = histIdx === null ? history.length : histIdx;
    const idx = cur + dir;
    if (idx < 0) return;
    if (idx >= history.length) {
      setHistIdx(null);
      setInput("");
      return;
    }
    setHistIdx(idx);
    setInput(history[idx]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (showSuggest) accept(suggestions[selClamped]);
    } else if (e.key === "ArrowDown") {
      if (showSuggest) {
        e.preventDefault();
        setSel((s) => (s + 1) % suggestions.length);
      } else {
        recallHistory(1);
      }
    } else if (e.key === "ArrowUp") {
      if (showSuggest) {
        e.preventDefault();
        setSel((s) => (s - 1 + suggestions.length) % suggestions.length);
      } else {
        e.preventDefault();
        recallHistory(-1);
      }
    } else if (e.key === "Escape") {
      setDismissed(true);
    }
  }

  return (
    <div className="about-terminal">
      <div className="about-term-scan" aria-hidden="true" />
      <div className="about-term-bar">
        <span className="about-term-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="about-term-titlebar">{prompt}</span>
        <button
          type="button"
          className={pop > 0 ? "about-term-version is-pop" : "about-term-version"}
          onClick={runVersion}
          title="version"
        >
          v{version}
          {pop > 0 && (
            <span key={pop} className="about-confetti" aria-hidden="true">
              {CONFETTI.map((c, i) => (
                <span
                  key={i}
                  className="about-confetti-bit"
                  style={
                    {
                      "--dx": `${c.dx}px`,
                      "--dy": `${c.dy}px`,
                      "--rot": `${c.rot}deg`,
                      animationDelay: `${c.delay}ms`,
                    } as CSSProperties
                  }
                >
                  {c.char}
                </span>
              ))}
            </span>
          )}
        </button>
      </div>

      <pre className="about-term-body" ref={bodyRef}>
        <div className="about-term-boot">{boot}</div>

        {rendered.map((b, i) =>
          b.typing ? (
            <div key={i} className="about-term-block">
              <div className="about-term-cmdline">
                <Prompt text={prompt} />
                <span className="about-term-cmd">{b.cmd}</span>
                <Cursor />
              </div>
            </div>
          ) : (
            <TermLines
              key={i}
              cmd={b.cmd}
              out={b.out}
              prompt={prompt}
              onOpen={onOpen}
            />
          )
        )}

        {finished && (
          <>
            <div className="about-term-out about-term-out--ok about-term-ready">
              {ready}
            </div>

            {entries.map((e, i) => (
              <TermLines
                key={i}
                cmd={e.cmd}
                out={e.out}
                prompt={prompt}
                onOpen={onOpen}
                fresh
              />
            ))}

            <div className="about-term-repl">
              <div
                className="about-term-inputline"
                onClick={() => inputRef.current?.focus()}
              >
                <Prompt text={prompt} />
                <span className="about-term-field">
                  <span className="about-term-echo" aria-hidden="true">
                    {input}
                    <Cursor idle={!focused} />
                  </span>
                  <input
                    ref={inputRef}
                    className="about-term-input"
                    value={input}
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    aria-label={inputAria}
                    role="combobox"
                    aria-expanded={showSuggest}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={
                      showSuggest ? `${listId}-${selClamped}` : undefined
                    }
                    onChange={(e) => {
                      setInput(e.target.value);
                      setSel(0);
                      setDismissed(false);
                      setHistIdx(null);
                    }}
                    onKeyDown={onKeyDown}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                  />
                </span>
              </div>

              {showSuggest ? (
                <ul className="about-term-suggest" id={listId} role="listbox">
                  {suggestions.map((sg, i) => (
                    <li
                      key={sg.value}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === selClamped}
                      className={
                        i === selClamped
                          ? "about-term-suggest-item is-sel"
                          : "about-term-suggest-item"
                      }
                      onMouseDown={(e) => {
                        e.preventDefault();
                        accept(sg);
                      }}
                    >
                      <span className="about-term-suggest-name">{sg.label}</span>
                      {sg.hint && (
                        <span className="about-term-suggest-hint">{sg.hint}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                entries.length === 0 && (
                  <div className="about-term-hint">{hint}</div>
                )
              )}
            </div>
          </>
        )}
      </pre>

      {!reduced && (
        <div className="about-term-controls">
          {finished ? (
            <button type="button" className="about-term-ctrl" onClick={onReplay}>
              <ScrambleText text={labels.replay} duration={450} />
            </button>
          ) : (
            <button
              type="button"
              className="about-term-ctrl"
              onClick={() => setSkipped(true)}
            >
              <ScrambleText text={labels.skip} duration={450} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
