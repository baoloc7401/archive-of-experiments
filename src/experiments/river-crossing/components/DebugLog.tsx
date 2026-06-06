import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { Tooltip } from "../../../components/ui";
import type { DebugEntry } from "../types";

interface Props {
  entries: DebugEntry[];
  /** Assembled lazily on copy so the full snapshot is only built on demand. */
  buildReport: () => string;
  onClear: () => void;
}

const KIND_MARK: Record<DebugEntry["kind"], string> = {
  cross: "⛴",
  win: "★",
  lost: "✖",
  setup: "·",
  solver: "▸",
  undo: "↩",
};

export default function DebugLog({ entries, buildReport, onClear }: Props) {
  const { t } = useTranslation();
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
      // Fallback for environments without async clipboard access.
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
    <section className="rc-debug">
      <div className="rc-debug-head">
        <span className="rc-panel-head rc-panel-head--inline">
          <ScrambleText text={t("experiments.river-crossing.debug.title")} duration={500} />
        </span>
        <div className="rc-debug-actions">
          <span className="rc-debug-count">{entries.length}</span>
          <Tooltip label={t("experiments.river-crossing.debug.clear_hint")}>
            <button
              type="button"
              className="rc-debug-clear"
              onClick={onClear}
              disabled={entries.length === 0}
            >
              <ScrambleText text={t("experiments.river-crossing.debug.clear")} duration={500} />
            </button>
          </Tooltip>
          <Tooltip label={t("experiments.river-crossing.debug.copy_hint")}>
          <button
            type="button"
            className={`rc-debug-copy${copied ? " rc-debug-copy--ok" : ""}`}
            onClick={copy}
          >
            <ScrambleText
              text={
                copied
                  ? t("experiments.river-crossing.debug.copied")
                  : t("experiments.river-crossing.debug.copy")
              }
              duration={500}
            />
          </button>
          </Tooltip>
        </div>
      </div>

      <div className="rc-debug-list" ref={listRef}>
        {entries.length === 0 ? (
          <div className="rc-debug-empty">
            <ScrambleText text={t("experiments.river-crossing.debug.empty")} duration={500} />
          </div>
        ) : (
          entries.slice(-120).map((e) => (
            <div key={e.id} className={`rc-debug-row rc-debug-row--${e.kind}`}>
              <span className="rc-debug-mark">{KIND_MARK[e.kind]}</span>
              <span className="rc-debug-n">{e.n != null ? `#${e.n}` : "-"}</span>
              <span className="rc-debug-text">{e.text}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
