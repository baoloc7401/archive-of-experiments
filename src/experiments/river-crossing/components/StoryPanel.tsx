import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import ScrambleText from "@/components/ScrambleText";
import { Tooltip } from "@/components/ui";
import type { Config, Move, Status } from "../types";
import { generateStory, type StoryBeat } from "../narrative/storyEngine";

interface Props {
  cfg: Config;
  moves: Move[];
  status: Status;
}

/** Tension (0..100) → a coarse band the CSS tints by. */
function band(tension: number): string {
  if (tension >= 70) return "dire";
  if (tension >= 45) return "tense";
  if (tension >= 25) return "uneasy";
  return "calm";
}

/** Flatten the beats into a clean prose telling - one paragraph per beat, no
 *  numbering (the on-screen crossing numbers are a UI aid, not part of a story). */
function buildStoryText(beats: StoryBeat[]): string {
  const body = beats.map((b) => b.text).join("\n\n");
  return `River Crossing - a telling\n\n${body}`;
}

export default function StoryPanel({ cfg, moves, status }: Props) {
  const { t } = useTranslation();
  const [seed, setSeed] = useState(1);
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const beats = useMemo(
    () => generateStory(cfg, moves, status, seed),
    [cfg, moves, status, seed]
  );

  // Follow the tale as it's written, but only when already near the bottom.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [beats.length]);

  async function copy() {
    const text = buildStoryText(beats);
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
    <section className="rc-story">
      <div className="rc-story-head">
        <span className="rc-panel-head rc-panel-head--inline">
          <ScrambleText text={t("experiments.river-crossing.story.title")} duration={500} />
        </span>
        <div className="rc-story-actions">
          <Tooltip label={t("experiments.river-crossing.story.copy_hint")}>
            <button
              type="button"
              className={`rc-story-btn${copied ? " rc-story-btn--ok" : ""}`}
              onClick={copy}
            >
              <ScrambleText
                text={t(
                  copied ? "experiments.river-crossing.story.copied" : "experiments.river-crossing.story.copy"
                )}
                duration={500}
              />
            </button>
          </Tooltip>
          <Tooltip label={t("experiments.river-crossing.story.retell_hint")}>
            <button
              type="button"
              className="rc-story-btn"
              onClick={() => setSeed((s) => s + 1)}
            >
              <ScrambleText text={t("experiments.river-crossing.story.retell")} duration={500} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="rc-story-list" ref={listRef}>
        {beats.map((b) => (
          <p
            key={b.id}
            className={`rc-story-beat rc-story-beat--${b.kind} rc-story-beat--${band(b.tension)}`}
          >
            {b.n != null && <span className="rc-story-n">{b.n}</span>}
            <span className="rc-story-text">{b.text}</span>
          </p>
        ))}
      </div>
    </section>
  );
}
