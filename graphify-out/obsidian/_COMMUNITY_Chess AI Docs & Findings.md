---
type: community
members: 17
---

# Chess AI Docs & Findings

**Members:** 17 nodes

## Members
- [[Chess AI Improvement Roadmap]] - document - docs/chess/IMPROVEMENTS.md
- [[Chess AI Known Issues]] - document - docs/chess/ISSUES.md
- [[Chess AI Textbook]] - document - docs/chess/TEXTBOOK.md
- [[Chess Programming Wiki references]] - document - docs/chess/IMPROVEMENTS.md
- [[Deterministic seeded Zobrist hashing]] - concept - docs/chess/TEXTBOOK.md
- [[Difficulty as a vector of knobs (noise, top-N, eval toggles)]] - concept - docs/chess/TEXTBOOK.md
- [[Flat objective makes a correct optimiser pick randomly]] - rationale - docs/chess/TEXTBOOK.md
- [[Makeunmake mutation pattern]] - concept - docs/chess/TEXTBOOK.md
- [[Mate-distance encoding (leaf + TT round-trip)]] - rationale - docs/chess/TEXTBOOK.md
- [[Math.random() at module load is thread-local (cross-thread hash bug)]] - rationale - docs/chess/TEXTBOOK.md
- [[Minimax + alpha-beta search]] - concept - docs/chess/IMPROVEMENTS.md
- [[Mop-up heuristic & king restriction]] - concept - docs/chess/ISSUES.md
- [[Move ordering (TT  MVV-LVA  killers  history)]] - concept - docs/chess/IMPROVEMENTS.md
- [[Pruning suite (NMP, futility, LMR, PVS)]] - concept - docs/chess/IMPROVEMENTS.md
- [[Transposition table]] - concept - docs/chess/IMPROVEMENTS.md
- [[Web Worker off-thread search]] - concept - docs/chess/TEXTBOOK.md
- [[Won-endgame conversion failure]] - rationale - docs/chess/ISSUES.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Chess_AI_Docs__Findings
SORT file.name ASC
```
