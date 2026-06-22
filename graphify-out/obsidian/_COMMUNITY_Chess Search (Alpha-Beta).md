---
type: community
members: 32
---

# Chess Search (Alpha-Beta)

**Members:** 32 nodes

## Members
- [[TTEntry]] - code - src/experiments/chess/ai/tables.ts
- [[TTFlag]] - code - src/experiments/chess/ai/tables.ts
- [[alphaBeta()]] - code - src/experiments/chess/ai/search.ts
- [[clearTT()]] - code - src/experiments/chess/ai/tables.ts
- [[getBestMove()]] - code - src/experiments/chess/ai/index.ts
- [[getLegalMoves()]] - code - src/experiments/chess/engine.ts
- [[histKey()]] - code - src/experiments/chess/ai/ordering.ts
- [[histTable]] - code - src/experiments/chess/ai/tables.ts
- [[index.ts_1]] - code - src/experiments/chess/ai/index.ts
- [[isEndgame()]] - code - src/experiments/chess/ai/evaluate.ts
- [[isInCheck()]] - code - src/experiments/chess/engine.ts
- [[isSameMove()]] - code - src/experiments/chess/ai/ordering.ts
- [[lookupBookMove()]] - code - src/experiments/chess/ai/book.ts
- [[makeMove()]] - code - src/experiments/chess/engine.ts
- [[makeNullMove()]] - code - src/experiments/chess/engine.ts
- [[moveScore()]] - code - src/experiments/chess/ai/ordering.ts
- [[opponent()]] - code - src/experiments/chess/engine.ts
- [[orderMoves()]] - code - src/experiments/chess/ai/ordering.ts
- [[ordering.ts]] - code - src/experiments/chess/ai/ordering.ts
- [[positionKey()]] - code - src/experiments/chess/engine.ts
- [[quiesce()]] - code - src/experiments/chess/ai/search.ts
- [[scoreFromTT()]] - code - src/experiments/chess/ai/search.ts
- [[scoreToTT()]] - code - src/experiments/chess/ai/search.ts
- [[search.ts]] - code - src/experiments/chess/ai/search.ts
- [[setSearchOptions()]] - code - src/experiments/chess/ai/searchOptions.ts
- [[tables.ts]] - code - src/experiments/chess/ai/tables.ts
- [[tt]] - code - src/experiments/chess/ai/tables.ts
- [[unmakeMove()]] - code - src/experiments/chess/engine.ts
- [[unmakeNullMove()]] - code - src/experiments/chess/engine.ts
- [[weightedPickIndex()]] - code - src/experiments/chess/ai/index.ts
- [[zEp()]] - code - src/experiments/chess/zobrist.ts
- [[zTurn()]] - code - src/experiments/chess/zobrist.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Chess_Search_Alpha-Beta
SORT file.name ASC
```

## Connections to other communities
- 23 edges to [[_COMMUNITY_Chess Engine Core]]
- 17 edges to [[_COMMUNITY_Chess Evaluation]]
- 12 edges to [[_COMMUNITY_Chess AI Worker]]
- 11 edges to [[_COMMUNITY_Chess Game UI]]
- 4 edges to [[_COMMUNITY_Chess Game Mode & Setup]]
- 4 edges to [[_COMMUNITY_Chess Types & Pieces]]
- 1 edge to [[_COMMUNITY_Graph Search Core (AMonte-Carlo)]]

## Top bridge nodes
- [[index.ts_1]] - degree 28, connects to 6 communities
- [[search.ts]] - degree 31, connects to 5 communities
- [[isInCheck()]] - degree 11, connects to 4 communities
- [[getLegalMoves()]] - degree 15, connects to 3 communities
- [[ordering.ts]] - degree 13, connects to 3 communities