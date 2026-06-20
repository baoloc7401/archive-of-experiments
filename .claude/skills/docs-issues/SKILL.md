---
name: docs-issues
description: >-
  Write or update an ISSUES.md bug/craft log for an experiment in this repo
  (docs/<id>/ISSUES.md). Use when the user asks to "log an issue", "write up
  the bug", "record what broke and how it was fixed", "update ISSUES", or after
  a debugging session worth preserving. Produces the repo's canonical
  known-issues format: flat ISSUE-N entries with Status/Severity (and an Area
  tag), root-cause and fix narrative, and a Verified-clean section.
---

# Issues / craft-log doc

A `docs/<id>/ISSUES.md` is this repo's **bug + craft log** for an experiment:
the specific defects hit, their root causes, the fixes, and the regressions to
avoid re-introducing. It is the full debugging narrative a maintainer reads
before touching the code. Models (match these exactly):
[`docs/chess/ISSUES.md`](../../../docs/chess/ISSUES.md) (few deep issues),
[`docs/elevator/ISSUES.md`](../../../docs/elevator/ISSUES.md) (issues + craft
decisions), [`docs/pacman/ISSUES.md`](../../../docs/pacman/ISSUES.md) (many small
triage items with Area tags).

## When to use

- "Log this bug", "write up what broke", "record the cause and fix", "update
  ISSUES for <experiment>", "note this regression so we don't repeat it."
- After a build/debug session where a non-obvious bug was found and fixed.

## What an ISSUES doc is (vs its siblings)

- **ISSUES.md** - bug/craft log: specific bugs, causes, fixes, regressions to
  avoid. The *what broke and why*. (This skill.)
- **TEXTBOOK.md** - theory + fidelity + research findings. A TEXTBOOK *summarizes*
  a finding and points here for the gory detail. Cross-link, do not duplicate.
  (Skill: `docs-textbook`.)
- **IMPROVEMENTS.md** - the forward-looking roadmap of what to build next.
  (Skill: `docs-improvements`.)

## Procedure

1. **Gather ground truth - do not invent.**
   - Read the experiment source under `src/experiments/<id>/` (engine, hooks,
     constants, rendering). Quote real symbol names, constants, and file paths;
     verify every claim against the code.
   - Read any existing `docs/<id>/ISSUES.md`, plus `IMPROVEMENTS.md` and
     `TEXTBOOK.md` if present, so the entry cross-links instead of duplicating.
   - Skim git history for the fix (`git log --oneline -- src/experiments/<id>`).
   - Mine the conversation: the symptom, the *real* root cause(s), the fix, and
     what would regress it.
2. **Classify** each issue: a **Severity** (High/Medium/Low) and a **Status**
   (see legend), plus an optional **Area** tag when the doc has many items and
   benefits from grouping (correctness, performance, accessibility, UX, tech
   debt, licensing, feature gap).
3. **Draft** in the structure below. Number issues sequentially (`ISSUE-N`);
   never renumber existing entries - append new ones.
4. **Verify** `npx tsc --noEmit` only if you touched code; the doc itself needs
   no build. Re-check that code links resolve and constants match.
5. **Maintain.** When a bug is fixed, flip its `**Status:**` to `Fixed` (or
   `Fixed (needs verification)` until confirmed in-browser, `Resolved` once
   confirmed), and keep the root-cause narrative so the lesson survives.

## House style (match the three examples exactly)

- **Title:** `# <Experiment Name> - Known Issues`. (No "& Craft Log" suffix; if
  the doc also records design decisions, say so in the intro and keep a
  `## Design decisions` section, as elevator does.)
- **Lead block:** a `Reference:` line linking the key source files, then a
  2-3 line framing of what the log is.
- **Legend** (verbatim, both lines) so severity/status vocabulary is uniform:
  ```
  Severity: **High** (correctness, fix soon) · **Medium** (quality / polish) · **Low** (nice-to-have / future).
  Status: **Open** · **Fixed** · **Fixed (needs verification)** · **Resolved** · **Skipped**.
  ```
- **Per-issue heading:** `## ISSUE-N: <title>`, flat-numbered across the whole
  doc.
- **Metadata line** directly under the heading, single line, ` · `-separated:
  `**Status:** … · **Severity:** …` and, where the doc groups by area,
  `· **Area:** …`.
- **Body:** the symptom, then the root cause(s), then the fix. Use
  `### Symptoms` / `### Root cause(s)` / `### Fix` / `### Reproduction`
  subsections for deep issues; a paragraph plus a `- **Resolved:**` bullet is
  enough for small ones. Be honest about *why* a bug happened and what would
  bring it back ("Wrong turns taken (do not repeat)").
- **Separators:** a `---` between issues.
- **Closing sections:** `## Notes` / `## Notes / open questions` for caveats, and
  a `## Verified clean / not issues` list of things checked and found fine.
- **Tone:** precise, plain, honest over flattering. Convert relative dates to
  absolute. Quote concrete behaviour and real symbol names, not vague summaries.

## Skeleton

```markdown
# <Name> - Known Issues

Reference: [`file.ts`](../../src/experiments/<id>/file.ts), … .

<2-3 sentence framing. Companion to IMPROVEMENTS.md / TEXTBOOK.md.>

Severity: **High** (correctness, fix soon) · **Medium** (quality / polish) · **Low** (nice-to-have / future).
Status: **Open** · **Fixed** · **Fixed (needs verification)** · **Resolved** · **Skipped**.

---

## ISSUE-1: <title>

**Status:** … · **Severity:** … [· **Area:** …]

### Symptoms
### Root cause(s)
### Fix
### Reproduction

---

## ISSUE-2: <title>

**Status:** … · **Severity:** …

<symptom + cause + fix>

---

## Notes

## Verified clean / not issues
- …
```
</content>
