---
source_file: "src/experiments/chess/engine.ts"
type: "code"
community: "Chess Engine Core"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Chess_Engine_Core
---

# engine.ts

## Connections
- [[ALL_DIRS]] - `contains` [EXTRACTED]
- [[Board]] - `imports` [EXTRACTED]
- [[Color]] - `imports` [EXTRACTED]
- [[DIAGS]] - `contains` [EXTRACTED]
- [[KING_OFFS]] - `contains` [EXTRACTED]
- [[KNIGHT_OFFS]] - `contains` [EXTRACTED]
- [[Move]] - `imports` [EXTRACTED]
- [[NullUndoInfo]] - `contains` [EXTRACTED]
- [[ORTHOS]] - `contains` [EXTRACTED]
- [[Piece]] - `imports` [EXTRACTED]
- [[PieceType]] - `imports` [EXTRACTED]
- [[Position]] - `imports` [EXTRACTED]
- [[UndoInfo]] - `contains` [EXTRACTED]
- [[addKingMoves()]] - `contains` [EXTRACTED]
- [[addKnightMoves()]] - `contains` [EXTRACTED]
- [[addPawnMoves()]] - `contains` [EXTRACTED]
- [[addSlidingMoves()]] - `contains` [EXTRACTED]
- [[applyMove()]] - `contains` [EXTRACTED]
- [[book.ts]] - `imports_from` [EXTRACTED]
- [[cloneBoard()]] - `contains` [EXTRACTED]
- [[clonePosition()]] - `contains` [EXTRACTED]
- [[computeZobrist()]] - `imports` [EXTRACTED]
- [[evaluate.ts]] - `imports_from` [EXTRACTED]
- [[findKing()]] - `contains` [EXTRACTED]
- [[getGameStatus()]] - `contains` [EXTRACTED]
- [[getLegalMoves()]] - `contains` [EXTRACTED]
- [[index.ts_1]] - `imports_from` [EXTRACTED]
- [[initialPosition()]] - `contains` [EXTRACTED]
- [[isInCheck()]] - `contains` [EXTRACTED]
- [[isSquareAttacked()]] - `contains` [EXTRACTED]
- [[kingSafety.ts]] - `imports_from` [EXTRACTED]
- [[makeMove()]] - `contains` [EXTRACTED]
- [[makeNullMove()]] - `contains` [EXTRACTED]
- [[onBoard()_1]] - `contains` [EXTRACTED]
- [[opponent()]] - `contains` [EXTRACTED]
- [[positionKey()]] - `contains` [EXTRACTED]
- [[pseudoLegalMoves()]] - `contains` [EXTRACTED]
- [[search.ts]] - `imports_from` [EXTRACTED]
- [[types.ts_2]] - `imports_from` [EXTRACTED]
- [[unmakeMove()]] - `contains` [EXTRACTED]
- [[unmakeNullMove()]] - `contains` [EXTRACTED]
- [[useChessGame.ts]] - `imports_from` [EXTRACTED]
- [[utils.ts]] - `imports_from` [EXTRACTED]
- [[zCastle()]] - `imports` [EXTRACTED]
- [[zEp()]] - `imports` [EXTRACTED]
- [[zPiece()]] - `imports` [EXTRACTED]
- [[zTurn()]] - `imports` [EXTRACTED]
- [[zobrist.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/Chess_Engine_Core