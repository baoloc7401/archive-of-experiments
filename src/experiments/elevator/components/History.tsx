import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ScrambleText from '../../../components/ScrambleText';
import type { LogEntry, SimState } from '../types';
import { ALGORITHM_BY_ID } from '../constants';

interface Props {
  state: SimState;
  speedLabel: string;
}

function formatEntry(e: LogEntry): string {
  const t = `[t=${String(e.tick).padStart(3, ' ')}]`;
  const who = e.algorithm ? ALGORITHM_BY_ID[e.algorithm].name.padEnd(6, ' ') : '--    ';
  return `${t} ${who} ${e.text}`;
}

function buildClipboardText(state: SimState, speedLabel: string): string {
  const algos = state.elevators.map(el => ALGORITHM_BY_ID[el.algorithm].name).join(', ');
  const header = [
    'elevator scheduling - debug log',
    `algorithms: ${algos}`,
    `floors: ${state.totalFloors} · speed: ${speedLabel} · tick: ${state.tick} · status: ${state.status}`,
    '─'.repeat(40),
  ];
  const body = state.log.map(formatEntry);
  return [...header, ...body].join('\n');
}

export default function History({ state, speedLabel }: Props) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-scroll to the newest entry, but only if the user is near the bottom.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [state.log.length]);

  async function copy() {
    const text = buildClipboardText(state, speedLabel);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for environments without async clipboard access.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="elev-history">
      <div className="elev-history-head">
        <span><ScrambleText text={t('experiments.elevator.history')} duration={600} /></span>
        <div className="elev-history-actions">
          <span className="elev-history-count">{state.log.length}</span>
          <button
            type="button"
            className={`elev-history-copy${copied ? ' elev-history-copy--ok' : ''}`}
            onClick={copy}
            disabled={state.log.length === 0}
          >
            <ScrambleText
              text={copied ? t('experiments.elevator.copied') : t('experiments.elevator.copy')}
              duration={600}
            />
          </button>
        </div>
      </div>
      <div className="elev-history-list" ref={listRef}>
        {state.log.length === 0 ? (
          <div className="elev-history-empty">
            <ScrambleText text={t('experiments.elevator.no_events')} duration={600} />
          </div>
        ) : (
          /* Only the most recent slice is rendered to keep per-tick re-renders
             cheap in compare mode; `copy` still exports the full log. */
          state.log.slice(-80).map(e => (
            <div key={e.id} className={`elev-history-row elev-history-row--${e.kind}`}>
              <span className="elev-history-t">t{e.tick}</span>
              {e.algorithm ? (
                <span className="elev-history-algo">{ALGORITHM_BY_ID[e.algorithm].name}</span>
              ) : (
                <span className="elev-history-algo elev-history-algo--sys">-</span>
              )}
              <span className="elev-history-text">{e.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
