import { MAX_STRING_LEN } from "./constants";

/** A parsed production: the single symbol `key` rewrites to `value`. */
export type RuleMap = Map<string, string>;

/**
 * One rule per line, `S=replacement` (also `S -> replacement` or `S: ...`). The
 * key is always the first non-space character, so the separator is anchored
 * right after it: the replacement body may itself contain `->` (e.g. a `-` turn
 * followed by a `>` roll, as in the 3D Hilbert curve) without being mistaken for
 * the separator. Blank or unparseable lines are skipped so a half-typed rule
 * never throws.
 */
const RULE_RE = /^(\S)\s*(?:->|=|:)\s*(.*)$/;

export function parseRules(text: string): RuleMap {
  const map: RuleMap = new Map();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = RULE_RE.exec(line);
    if (!m) continue;
    map.set(m[1], m[2]);
  }
  return map;
}

/**
 * Apply the productions to `axiom` `iterations` times. Any symbol without a rule
 * is a constant and copies through unchanged. Growth is capped at
 * {@link MAX_STRING_LEN}: once an expansion would overflow we stop rewriting and
 * keep the last in-budget string, so a runaway grammar degrades instead of
 * freezing the tab.
 */
export function expand(axiom: string, rules: RuleMap, iterations: number): string {
  let current = axiom;
  for (let it = 0; it < iterations; it++) {
    let next = "";
    let overflow = false;
    for (let i = 0; i < current.length; i++) {
      const sym = current[i];
      const rule = rules.get(sym);
      next += rule ?? sym;
      if (next.length > MAX_STRING_LEN) {
        overflow = true;
        break;
      }
    }
    if (overflow) return current;
    current = next;
  }
  return current;
}
