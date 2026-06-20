---
name: docs-improvements
description: >-
  Write or update an IMPROVEMENTS.md roadmap for an experiment in this repo
  (docs/<id>/IMPROVEMENTS.md). Use when the user asks to "make a roadmap",
  "plan improvements", "track what to build next", "add an improvement idea",
  or flip a shipped item to Done. Produces the repo's canonical roadmap format:
  a "What it already does" table, tiered numbered entries with a PROGRESS marker
  and Shipped/What/Why/Caveat fields, and a maintenance footer.
---

# Improvements / roadmap doc

A `docs/<id>/IMPROVEMENTS.md` is this repo's **forward-looking roadmap** for an
experiment: what the code already does, and the tiered, prioritized list of what
could be built next - each entry carrying its own `PROGRESS` so the doc doubles
as a build log. It tracks *intent*; the TEXTBOOK records what was learned.
Models (match these exactly): [`docs/boids/IMPROVEMENTS.md`](../../../docs/boids/IMPROVEMENTS.md)
and [`docs/river-crossing/IMPROVEMENTS.md`](../../../docs/river-crossing/IMPROVEMENTS.md)
(canonical tiered roadmap), [`docs/chess/IMPROVEMENTS.md`](../../../docs/chess/IMPROVEMENTS.md)
(roadmap + reference tables).

## When to use

- "Make a roadmap for <experiment>", "plan the next improvements", "add this idea
  to the backlog", "mark item N as Done", "what's left to build."
- After shipping a feature whose entry should flip to `PROGRESS: Done` with a
  `**Shipped:**` note.

## What an IMPROVEMENTS doc is (vs its siblings)

- **IMPROVEMENTS.md** - the roadmap: what exists + what's planned, tier-ranked.
  The *what to build next*. (This skill.)
- **TEXTBOOK.md** - theory + fidelity + research findings. (Skill: `docs-textbook`.)
- **ISSUES.md** - bug/craft log of defects and fixes. (Skill: `docs-issues`.)

## Procedure

1. **Gather ground truth - do not invent.**
   - Read the experiment source under `src/experiments/<id>/` (engine, hooks,
     constants, rendering). The "What it already does" table must reflect the
     real code: quote actual feature names, constants, and files.
   - Read any existing `docs/<id>/IMPROVEMENTS.md`, plus `ISSUES.md` and
     `TEXTBOOK.md`, so the roadmap links to them rather than repeating them.
   - For each improvement, note real sources where relevant (papers, wikis) in
     the `Sources:` line.
2. **Rank** ideas into **Tiers** by value (highest-impact first). Give each a
   one-line tier label (e.g. "Tier 1 - Highest Impact").
3. **Draft** in the structure below. Each `#### N. Title` gets a `PROGRESS:`
   line (`Done` / `Doing` / `TODO` / `N/A`). Number sequentially; never
   renumber shipped entries.
4. **Verify** `npx tsc --noEmit` only if you touched code; the doc needs no build.
   Re-check that code links resolve.
5. **Maintain.** When an item ships, flip its `PROGRESS` to `Done` and lead the
   entry with a `**Shipped:**` note describing what actually landed (keep the
   original `**What:**` / `**Why:**` as the recorded intent). Fold the durable
   lesson into the TEXTBOOK; this file tracks intent, the textbook records what
   was learned.

## House style (match the examples exactly)

- **Title:** `# <Experiment Name> - Improvement Roadmap`.
- **Lead block:** a `Reference:` line linking the key files (note each file's
  role for a modular experiment), an optional `Sources:` line of `·`-separated
  external references, then the verbatim note:
  ```
  Note: As we move down the implementations, update each entry's PROGRESS as
  TODO / Doing / Done.
  ```
- **`## What the <Engine|Experiment> Already Does`** - a `| Feature | Detail |`
  table summarizing the current build, optionally followed by a short framing
  paragraph on what the improvement axis even is (e.g. legibility/scale vs
  solution strength).
- **`## Improvements`** then `### Tier N - <label>` subsections, a `---` before
  each item, and `#### N. <Title>` entries.
- **Per-item:** a `PROGRESS: <Done|Doing|TODO|N/A>` line, then bold fields as
  needed: `**Shipped:**` (when Done), `**What:**`, `**Why it matters:**`,
  `**Caveat:**`, `**Implementation sketch:**` (fenced code), `**Expected gain:**`.
- **Footer (verbatim):**
  ```
  *Maintained alongside the code. When an item ships, flip its PROGRESS to Done and
  fold the lasting lessons into [TEXTBOOK.md](TEXTBOOK.md); this file tracks intent,
  the textbook records what was learned.*
  ```
- **Tone:** precise, plain, honest about trade-offs. Convert relative dates to
  absolute. State why a deferred item was skipped, not just that it was.

## When the content doesn't fit a tiered roadmap

Two existing docs deliberately diverge in body structure while keeping the same
title / header / separator / footer conventions - follow their precedent rather
than forcing the tiered template:

- A **round-by-round performance log** (score tables per round) - see
  [`docs/pagespeed/IMPROVEMENTS.md`](../../../docs/pagespeed/IMPROVEMENTS.md).
- An **effort/pillar-tagged idea backlog** (bulleted, tagged `S/M/L` +
  `EDU/PLAY/TECH/…`, `- DONE` markers) - see
  [`docs/pacman/IMPROVEMENTS.md`](../../../docs/pacman/IMPROVEMENTS.md).

Keep the canonical title, `Reference:` lead, `---` separators, and footer; let
the body be what the content needs.

## Skeleton

```markdown
# <Name> - Improvement Roadmap

Reference: [`file.ts`](../../src/experiments/<id>/file.ts) (role), … .

Sources: [Name](url) · [Name](url)

Note: As we move down the implementations, update each entry's PROGRESS as
TODO / Doing / Done.

---

## What the Experiment Already Does

| Feature | Detail |
|---|---|
| … | … |

---

## Improvements

### Tier 1 - <label>

---

#### 1. <Title>

PROGRESS: Done

**Shipped:** <what actually landed>

**What:** <the original intent>

**Why it matters:** <the payoff>

**Caveat:** <gotcha, if any>

---

*Maintained alongside the code. When an item ships, flip its PROGRESS to Done and
fold the lasting lessons into [TEXTBOOK.md](TEXTBOOK.md); this file tracks intent,
the textbook records what was learned.*
```
</content>
