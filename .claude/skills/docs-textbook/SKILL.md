---
name: docs-textbook
description: >-
  Write or update a research-grade TEXTBOOK.md for an experiment in this repo
  (docs/<id>/TEXTBOOK.md). Use when the user asks to "make a textbook", "record
  findings/research" for an experiment, document an algorithm faithfully, or
  capture what was learned building/debugging a visualization. Blends the
  canonical algorithm with the real findings, fidelity deviations, and
  engineering lessons discovered in the code and conversation.
---

# Textbook research doc

A `docs/<id>/TEXTBOOK.md` is this repo's **research record** for an experiment:
the canonical algorithm/theory, *how faithfully the code models it*, and - the
point - **the genuine findings discovered while building and debugging it.** It
is not a tutorial and not API docs. Models: [`docs/elevator/TEXTBOOK.md`](../../../docs/elevator/TEXTBOOK.md)
and [`docs/aco/TEXTBOOK.md`](../../../docs/aco/TEXTBOOK.md).

## When to use

- "Make a TEXTBOOK for <experiment>", "record our research/findings", "document
  the algorithm", "write up what we learned."
- After a substantial build/debug session whose insights are worth preserving.

## What a TEXTBOOK is (vs its siblings)

- **TEXTBOOK.md** - theory + fidelity + research findings. The *why it behaves
  this way* and *where the model parts ways with reality*. (This skill.)
- **ISSUES.md** - bug/craft log: specific bugs, causes, fixes, regressions to
  avoid. If one exists, **cross-link it; do not duplicate it.** TEXTBOOK
  summarizes a finding and points to ISSUES for the full debugging narrative.
  (Skill: `docs-issues`.)
- **IMPROVEMENTS.md** - the forward-looking roadmap of what to build next.
  (Skill: `docs-improvements`.)

## Procedure

1. **Gather ground truth - do not invent.**
   - Read the experiment source under `src/experiments/<id>/` (engine, hooks,
     constants, rendering). Quote real names, constants, and equations; verify
     every numeric claim (default params, thresholds) against the code.
   - Read `docs/<id>/ISSUES.md` and `IMPROVEMENTS.md` if present.
   - Skim git history for the experiment (`git log --oneline -- src/experiments/<id>`).
   - Mine the conversation: bugs hit, *why*, decisions made, fidelity trade-offs,
     anything that surprised you. These become the findings sections.
2. **Find the headline finding.** Identify the single deepest, non-obvious
   lesson - usually something you only learned by building it. This becomes §0.
3. **Draft** in the structure below.
4. **Verify** with `npx tsc --noEmit` only if you touched code; the doc itself
   needs no build. Re-check that code links resolve and constants match.
5. **Maintain.** End with a one-line maintenance note tying sections to the code
   they describe.
6. **Always sync the wiki.** After finishing (or materially updating) a
   `TEXTBOOK.md`, update the staged wiki pages in [`wiki/`](../../../wiki/) so
   the human-facing portal stays in step with the code-adjacent doc. Minimum
   set to touch:
   - `wiki/Home.md` - the "Experiment status" table's *Research docs* column
     for that experiment should list `TEXTBOOK` alongside ISSUES/IMPROVEMENTS.
   - `wiki/Experiment-<Name>.md` - add (or refresh) a deep-dive link to the
     new `TEXTBOOK.md`; while you're there, sanity-check the prose summary
     against what the TEXTBOOK actually says.
   - `wiki/Documentation-Conventions.md` - flip the TEXTBOOK column for that
     experiment from `-` to a ✓ pointing at the new doc.
   The wiki itself is published with [`scripts/sync-wiki.ps1`](../../../scripts/sync-wiki.ps1)
   - do not run it; the user does. Just commit the `wiki/` edits with the
   `docs/<id>/TEXTBOOK.md` change so they ship together.

## House style (match the two examples exactly)

- **Title:** `# <Experiment Name> - Textbook & Real-World Research`.
- **Lead block:** `Reference code:` with relative links from `docs/<id>/`
  (i.e. `../../src/experiments/<id>/...`) to the key files. Cross-link
  `ISSUES.md` as the "Bug/craft log" if it exists. Then a 2-4 sentence framing
  of what the record covers, ending on "Findings accumulated while building and
  debugging."
- **§0 - The single most important finding.** A `>` blockquote stating the
  insight in one or two sentences, then a short explanation. This is the most
  important section; make it land.
- **Numbered sections** thereafter. Blend canonical definition with fidelity.
  For a family of algorithms, give each a compact entry (Definition / Character /
  Our implementation / Fidelity). For one mechanism, use thematic sections
  (model & equations -> implementation choices -> parameter intuition -> findings).
- **Be honest about deviations.** State every place the code departs from the
  textbook and *why* it was a conscious choice. Findings are the product, not an
  afterthought.
- **Tables** for comparisons-at-a-glance and a **fidelity scorecard**
  (`✅` / `✅*` with the deviation noted).
- **Scope boundary section:** "Where this is *not* a real <thing>" - list what's
  deliberately out of scope so the reader doesn't mistake the teaching model for
  the real system.
- **Further real-world context:** variants, alternatives, and where the
  technique is actually used in practice.
- **Footer:** `*Maintained alongside the code. If <X> changes, update <which
  sections>.*`
- **Tone:** precise, plain, occasionally wry; honest over flattering. Convert
  relative dates to absolute. Prefer concrete observed behaviour ("under a
  scattered load FCFS finishes well after the others") over hand-waving.

## Skeleton

```markdown
# <Name> - Textbook & Real-World Research

Reference code: [`file.ts`](../../src/experiments/<id>/file.ts), … .
Bug/craft log: [`ISSUES.md`](./ISSUES.md).

<2-4 sentence framing. Ends on "Findings accumulated while building and debugging.">

---

## 0. The single most important finding
> **<one-sentence insight>**
<explanation>

## 1. <Shared model & terminology, or the algorithm + equations>
## 2. <The algorithms / mechanism - faithful definitions + our fidelity>
## 3. <Parameter or behaviour intuition, as observed>
## 4. <Real findings: visualization, animation, the hard bugs and their lessons>
## N. Fidelity scorecard
## N+1. Where this is *not* a real <thing> (scope boundary)
## N+2. Further real-world context

---

*Maintained alongside the code. If <X> changes, update <sections>.*
```
</content>
