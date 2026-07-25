import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Tooltip } from "@/components/ui";
import type { LogEntry } from "../types";

interface Props {
  entries: LogEntry[];
  buildReport: () => string;
  onClear: () => void;
}

const KIND_MARK: Record<LogEntry["kind"], string> = {
  gen: "✸",
  play: "·",
  win: "★",
  loss: "✖",
  setup: "◆",
  warn: "!",
};

export default function DebugLog({ entries, buildReport, onClear }: Props) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);

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
    <div className="ms-debug">
      <div className="ms-debug-head">
        <div className="ms-debug-actions">
          <Tooltip label={t("experiments.minesweeper.debug.clear_hint")}>
            <button
              type="button"
              className="ms-debug-clear"
              onClick={onClear}
              disabled={entries.length === 0}
            >
              <ScrambleText text={t("experiments.minesweeper.debug.clear")} duration={500} />
            </button>
          </Tooltip>
          <Tooltip label={t("experiments.minesweeper.debug.copy_hint")}>
            <button
              type="button"
              className={`ms-debug-copy${copied ? " ms-debug-copy--ok" : ""}`}
              onClick={copy}
            >
              <ScrambleText
                text={copied ? t("experiments.minesweeper.debug.copied") : t("experiments.minesweeper.debug.copy")}
                duration={500}
              />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="ms-debug-list" ref={listRef}>
        {entries.length === 0 ? (
          <div className="ms-debug-empty">
            <ScrambleText text={t("experiments.minesweeper.debug.empty")} duration={500} />
          </div>
        ) : (
          entries.slice(-120).map((e) => (
            <div key={e.id} className={`ms-debug-row ms-debug-row--${e.kind}`}>
              <span className="ms-debug-mark">{KIND_MARK[e.kind]}</span>
              <span className="ms-debug-text">{e.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
