import { useEffect, useState } from "react";
import { TERMINAL_LINES } from "./constants";

type Phase = "type" | "out" | "hold";

interface TermView {
  cmd: string;
  out: string;
  typing: boolean;
  showOut: boolean;
}

/**
 * Drives the fake terminal: types a failed command character by character,
 * reveals its error output, holds, then advances to the next line forever.
 * Each step self-schedules the next via a single timeout, so the effect stays
 * deterministic and tears down cleanly. Frozen to the first line under reduced
 * motion.
 */
export function useTypingTerminal(reduced: boolean): TermView {
  const [state, setState] = useState({ line: 0, chars: 0, phase: "type" as Phase });

  useEffect(() => {
    if (reduced) return;
    const cur = TERMINAL_LINES[state.line];
    let timer: number;

    if (state.phase === "type") {
      if (state.chars < cur.cmd.length) {
        timer = window.setTimeout(
          () => setState((s) => ({ ...s, chars: s.chars + 1 })),
          36 + Math.random() * 46
        );
      } else {
        timer = window.setTimeout(
          () => setState((s) => ({ ...s, phase: "out" })),
          380
        );
      }
    } else if (state.phase === "out") {
      timer = window.setTimeout(
        () => setState((s) => ({ ...s, phase: "hold" })),
        820
      );
    } else {
      timer = window.setTimeout(
        () =>
          setState({
            line: (state.line + 1) % TERMINAL_LINES.length,
            chars: 0,
            phase: "type",
          }),
        1700
      );
    }

    return () => window.clearTimeout(timer);
  }, [state, reduced]);

  const cur = TERMINAL_LINES[state.line];
  if (reduced) {
    return { cmd: cur.cmd, out: cur.out, typing: false, showOut: true };
  }
  return {
    cmd: state.phase === "type" ? cur.cmd.slice(0, state.chars) : cur.cmd,
    out: cur.out,
    typing: state.phase === "type",
    showOut: state.phase === "out" || state.phase === "hold",
  };
}
