import { useEffect, useRef, useState } from "react";
import ScrambleText from "../../../components/ScrambleText";
import type { LogEntry } from "../types";

interface Props {
  entries: LogEntry[];
  /** Assembled lazily on copy so the heavy colony dump is only built on demand. */
  buildReport: () => string;
  onClear: () => void;
}

const KIND_MARK: Record<LogEntry["kind"], string> = {
  run: "▸",
  setup: "·",
  best: "★",
  milestone: "◆",
  warn: "!",
};

export default function DebugLog({ entries, buildReport, onClear }: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-scroll to newest, but only when the user is already near the bottom.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  async function copy() {
    const text = buildReport();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="aco-debug">
      <div className="aco-debug-head">
        <span className="aco-panel-title">
          <ScrambleText text="debug log" duration={500} />
        </span>
        <div className="aco-debug-actions">
          <button
            type="button"
            className="aco-debug-clear"
            onClick={onClear}
            disabled={entries.length === 0}
            title="Clear the event log"
          >
            <ScrambleText text="clear" duration={500} />
          </button>
          <button
            type="button"
            className={`aco-debug-copy${copied ? " aco-debug-copy--ok" : ""}`}
            onClick={copy}
            title="Copy a full debug report (state + colony dump + events) to share"
          >
            <ScrambleText text={copied ? "✓ copied" : "copy report"} duration={500} />
          </button>
        </div>
      </div>

      <div className="aco-debug-list" ref={listRef}>
        {entries.length === 0 ? (
          <div className="aco-debug-empty">
            <ScrambleText text="no events yet — run, reset, or tweak something" duration={500} />
          </div>
        ) : (
          entries.slice(-120).map((e) => (
            <div key={e.id} className={`aco-debug-row aco-debug-row--${e.kind}`}>
              <span className="aco-debug-mark">{KIND_MARK[e.kind]}</span>
              <span className="aco-debug-iter">{e.iter != null ? `i${e.iter}` : "—"}</span>
              <span className="aco-debug-text">{e.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
