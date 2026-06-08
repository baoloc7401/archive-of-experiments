import { useEffect, useState } from "react";

export interface TermBlock {
  /** The command typed after the prompt (CLI tokens - not translated). */
  cmd: string;
  /** Output lines revealed one at a time after the command finishes typing. */
  out: string[];
}

export interface RenderedBlock {
  cmd: string;
  typing: boolean;
  out: string[];
}

type Phase = "type" | "out" | "done";

interface State {
  idx: number;
  chars: number;
  lines: number;
  phase: Phase;
}

const TYPE_MIN = 24;
const TYPE_JITTER = 42;
const AFTER_CMD_MS = 240;
const LINE_MS = 130;
const NEXT_BLOCK_MS = 420;

/**
 * Drives the About-page boot sequence: types each command character by
 * character, reveals its output line by line, then advances to the next block.
 * Unlike the NotFound terminal it runs once and settles (the content must stay
 * readable). Remount (via React `key`) to replay. Under reduced motion every
 * block is shown at once and the sequence is immediately `finished`.
 */
export function useAboutTerminal(
  script: TermBlock[],
  reduced: boolean
): { rendered: RenderedBlock[]; finished: boolean } {
  const [st, setSt] = useState<State>({
    idx: 0,
    chars: 0,
    lines: 0,
    phase: "type",
  });

  useEffect(() => {
    if (reduced || st.phase === "done") return;
    const cur = script[st.idx];
    let timer: number;

    if (st.phase === "type") {
      if (st.chars < cur.cmd.length) {
        timer = window.setTimeout(
          () => setSt((s) => ({ ...s, chars: s.chars + 1 })),
          TYPE_MIN + Math.random() * TYPE_JITTER
        );
      } else {
        timer = window.setTimeout(
          () => setSt((s) => ({ ...s, phase: "out" })),
          AFTER_CMD_MS
        );
      }
    } else if (st.lines < cur.out.length) {
      timer = window.setTimeout(
        () => setSt((s) => ({ ...s, lines: s.lines + 1 })),
        LINE_MS
      );
    } else if (st.idx + 1 < script.length) {
      timer = window.setTimeout(
        () => setSt({ idx: st.idx + 1, chars: 0, lines: 0, phase: "type" }),
        NEXT_BLOCK_MS
      );
    } else {
      timer = window.setTimeout(
        () => setSt((s) => ({ ...s, phase: "done" })),
        NEXT_BLOCK_MS
      );
    }

    return () => window.clearTimeout(timer);
  }, [st, script, reduced]);

  if (reduced) {
    return {
      rendered: script.map((b) => ({ cmd: b.cmd, typing: false, out: b.out })),
      finished: true,
    };
  }

  const rendered: RenderedBlock[] = [];
  for (let i = 0; i <= st.idx && i < script.length; i++) {
    if (i < st.idx) {
      rendered.push({ cmd: script[i].cmd, typing: false, out: script[i].out });
    } else {
      const typing = st.phase === "type";
      rendered.push({
        cmd: typing ? script[i].cmd.slice(0, st.chars) : script[i].cmd,
        typing,
        out: typing ? [] : script[i].out.slice(0, st.lines),
      });
    }
  }

  return { rendered, finished: st.phase === "done" };
}
