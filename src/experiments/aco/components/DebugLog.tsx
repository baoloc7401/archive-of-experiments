import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ScrambleText from "../../../components/ScrambleText";
import { Button, Panel } from "../../../components/ui";
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
    <Panel title={t("experiments.aco.debug")}>
      <div className="aco-debug-actions">
        <Button
          size="sm"
          onClick={onClear}
          disabled={entries.length === 0}
          tooltip={t("experiments.aco.debug_clear_hint")}
        >
          <ScrambleText text={t("experiments.aco.debug_clear")} duration={500} />
        </Button>
        <Button
          size="sm"
          variant={copied ? "primary" : "ghost"}
          onClick={copy}
          tooltip={t("experiments.aco.copy_hint")}
        >
          <ScrambleText
            text={copied ? t("experiments.aco.copied") : t("experiments.aco.copy_report")}
            duration={500}
          />
        </Button>
      </div>

      <div className="aco-debug-list" ref={listRef}>
        {entries.length === 0 ? (
          <div className="aco-debug-empty">
            <ScrambleText text={t("experiments.aco.debug_empty")} duration={500} />
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
    </Panel>
  );
}
