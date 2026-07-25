# Graph Report - .  (2026-07-25)

## Corpus Check
- 284 files · ~226,534 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1765 nodes · 4325 edges · 64 communities (59 shown, 5 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 133 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Pathfinding Search Algorithms|Pathfinding Search Algorithms]]
- [[_COMMUNITY_Cellular Automata Simulation Core|Cellular Automata Simulation Core]]
- [[_COMMUNITY_Minesweeper Solver Suite|Minesweeper Solver Suite]]
- [[_COMMUNITY_Elevator Building & Algorithm UI|Elevator Building & Algorithm UI]]
- [[_COMMUNITY_Minesweeper Board & Stats UI|Minesweeper Board & Stats UI]]
- [[_COMMUNITY_Boids Flocking Simulation|Boids Flocking Simulation]]
- [[_COMMUNITY_Reaction-Diffusion Preview & Canvas|Reaction-Diffusion Preview & Canvas]]
- [[_COMMUNITY_ACO Colony Engine|ACO Colony Engine]]
- [[_COMMUNITY_Pac-Man AI Planning|Pac-Man AI Planning]]
- [[_COMMUNITY_L-System Editor & Canvas|L-System Editor & Canvas]]
- [[_COMMUNITY_Pac-Man Maze Editor|Pac-Man Maze Editor]]
- [[_COMMUNITY_Pac-Man Maze Constants|Pac-Man Maze Constants]]
- [[_COMMUNITY_Pac-Man Canvas & Input|Pac-Man Canvas & Input]]
- [[_COMMUNITY_About Page Terminal|About Page Terminal]]
- [[_COMMUNITY_Pac-Man BFS Pathfinding|Pac-Man BFS Pathfinding]]
- [[_COMMUNITY_River Crossing Cast & Narrative|River Crossing Cast & Narrative]]
- [[_COMMUNITY_ACO & L-System Textbook Findings|ACO & L-System Textbook Findings]]
- [[_COMMUNITY_Chess Move Generation|Chess Move Generation]]
- [[_COMMUNITY_River Crossing Solver|River Crossing Solver]]
- [[_COMMUNITY_Chess Opening Book & Move Ordering|Chess Opening Book & Move Ordering]]
- [[_COMMUNITY_N-Body Barnes-Hut Octree|N-Body Barnes-Hut Octree]]
- [[_COMMUNITY_Shared PropsConfig UI Bits|Shared Props/Config UI Bits]]
- [[_COMMUNITY_Chess Evaluation Tables|Chess Evaluation Tables]]
- [[_COMMUNITY_N-Body Controls UI|N-Body Controls UI]]
- [[_COMMUNITY_Experiment Page Entry Components|Experiment Page Entry Components]]
- [[_COMMUNITY_Shared UI Primitives|Shared UI Primitives]]
- [[_COMMUNITY_Pac-Man AI Graph Utils|Pac-Man AI Graph Utils]]
- [[_COMMUNITY_N-Body Canvas & Camera|N-Body Canvas & Camera]]
- [[_COMMUNITY_Chess Opening Book Data|Chess Opening Book Data]]
- [[_COMMUNITY_Chess AI Skill Levels|Chess AI Skill Levels]]
- [[_COMMUNITY_Chess Board Constants|Chess Board Constants]]
- [[_COMMUNITY_N-Body Preset Generators|N-Body Preset Generators]]
- [[_COMMUNITY_Pac-Man Rendering|Pac-Man Rendering]]
- [[_COMMUNITY_Pac-Man Improvement Roadmap|Pac-Man Improvement Roadmap]]
- [[_COMMUNITY_Chess AI Improvement Roadmap|Chess AI Improvement Roadmap]]
- [[_COMMUNITY_Gateway Card & Filter UI|Gateway Card & Filter UI]]
- [[_COMMUNITY_404 Page Terminal & Debris|404 Page Terminal & Debris]]
- [[_COMMUNITY_SEO Route Metadata|SEO Route Metadata]]
- [[_COMMUNITY_App Route Table|App Route Table]]
- [[_COMMUNITY_Chess Pawn Structure Eval|Chess Pawn Structure Eval]]
- [[_COMMUNITY_River Crossing Search Graph UI|River Crossing Search Graph UI]]
- [[_COMMUNITY_Experiment Header & Lang Toggle|Experiment Header & Lang Toggle]]
- [[_COMMUNITY_Homegrown i18n Engine|Homegrown i18n Engine]]
- [[_COMMUNITY_N-Body Textbook Findings|N-Body Textbook Findings]]
- [[_COMMUNITY_N-Body Debug Panel|N-Body Debug Panel]]
- [[_COMMUNITY_River Crossing Person & Scene UI|River Crossing Person & Scene UI]]
- [[_COMMUNITY_ScrambleText Component|ScrambleText Component]]
- [[_COMMUNITY_N-Body WebGPU Solver|N-Body WebGPU Solver]]
- [[_COMMUNITY_PageSpeed Improvements Roadmap|PageSpeed Improvements Roadmap]]
- [[_COMMUNITY_Reaction-Diffusion Textbook Findings|Reaction-Diffusion Textbook Findings]]
- [[_COMMUNITY_River Crossing Improvement Roadmap|River Crossing Improvement Roadmap]]
- [[_COMMUNITY_Minesweeper & Pac-Man AI Concepts|Minesweeper & Pac-Man AI Concepts]]
- [[_COMMUNITY_Pathfinding Textbook Findings|Pathfinding Textbook Findings]]
- [[_COMMUNITY_Minesweeper Solver Textbook|Minesweeper Solver Textbook]]
- [[_COMMUNITY_Brand Identity Assets|Brand Identity Assets]]
- [[_COMMUNITY_Elevator Known Issues & Textbook|Elevator Known Issues & Textbook]]
- [[_COMMUNITY_i18n Locale Type System|i18n Locale Type System]]
- [[_COMMUNITY_River Crossing Story Panel|River Crossing Story Panel]]
- [[_COMMUNITY_App Entry & Mount|App Entry & Mount]]
- [[_COMMUNITY_Static Asset Images|Static Asset Images]]
- [[_COMMUNITY_React Asset|React Asset]]
- [[_COMMUNITY_Brand Mark Concept|Brand Mark Concept]]
- [[_COMMUNITY_Reaction-Diffusion Verification Tests|Reaction-Diffusion Verification Tests]]

## God Nodes (most connected - your core abstractions)
1. `useTranslation()` - 87 edges
2. `reveal()` - 21 edges
3. `Direction` - 21 edges
4. `tileToId()` - 19 edges
5. `Move` - 18 edges
6. `neighbor()` - 18 edges
7. `alphaBeta()` - 17 edges
8. `createKnowledge()` - 17 edges
9. `step()` - 17 edges
10. `GridConfig` - 17 edges

## Surprising Connections (you probably didn't know these)
- `River Crossing A* (admissible h)` --semantically_similar_to--> `A* Search (Manhattan Heuristic)`  [INFERRED] [semantically similar]
  docs/river-crossing/TEXTBOOK.md → docs/pathfinding/TEXTBOOK.md
- `Controls()` --calls--> `useTranslation()`  [INFERRED]
  src/experiments/aco/components/Controls.tsx → src/hooks/useTranslation.ts
- `DebugLog()` --calls--> `useTranslation()`  [INFERRED]
  src/experiments/aco/components/DebugLog.tsx → src/hooks/useTranslation.ts
- `Params()` --calls--> `useTranslation()`  [INFERRED]
  src/experiments/aco/components/Params.tsx → src/hooks/useTranslation.ts
- `Setup()` --calls--> `useTranslation()`  [INFERRED]
  src/experiments/aco/components/Setup.tsx → src/hooks/useTranslation.ts

## Import Cycles
- 3-file cycle: `src/experiments/pacman/constants.ts -> src/experiments/pacman/types.ts -> src/experiments/pacman/pellets/registry.ts -> src/experiments/pacman/constants.ts`

## Hyperedges (group relationships)
- **Debug-bridge methodology across experiments** — aco_textbook_debug_bridge, lsystem_textbook_debug_bridge_limit, chess_issues_won_endgame [INFERRED 0.75]
- **Correct solver on a flat objective makes random choices** — chess_textbook_flat_objective, chess_textbook_mate_distance, chess_issues_won_endgame [INFERRED 0.85]
- **Render the mechanism using the engine's own state** — aco_textbook_contrast_normalization, boids_textbook_rule_overlay, lsystem_textbook_depth_cueing [INFERRED 0.75]
- **Solver/Sim as Source of Truth Pattern** — minesweeper_textbook_solver_as_truth, river_crossing_textbook_solvability_output, pacman_textbook_framework_free_engine [INFERRED 0.75]
- **Headless Throwaway Harness Verification** — nbody_textbook_tsx_harness, pacman_textbook_framework_free_engine, river_crossing_textbook_debug_bridge [INFERRED 0.75]
- **Shared BFS/A* Graph Search Across Experiments** — pathfinding_textbook_bfs, pathfinding_textbook_astar, river_crossing_textbook_bfs, river_crossing_textbook_astar, minesweeper_textbook_tank_solver [INFERRED 0.85]

## Communities (64 total, 5 thin omitted)

### Community 0 - "Pathfinding Search Algorithms"
Cohesion: 0.05
Nodes (71): Node, expandOne(), Node, Node, MinHeap, ALGO_FACTORIES, blocked(), jump() (+63 more)

### Community 1 - "Cellular Automata Simulation Core"
Cohesion: 0.06
Nodes (63): CELL_LEVELS, CellLevelId, DEFAULT_GENOME, DEFAULT_PARAMS, countAlive(), createGrid(), drawGrid(), randomizeGrid() (+55 more)

### Community 2 - "Minesweeper Solver Suite"
Cohesion: 0.09
Nodes (71): backtrackingSolver, solve(), constraintPropagationSolver, solve(), applyForced(), buildConstraints(), components(), Constraint (+63 more)

### Community 3 - "Elevator Building & Algorithm UI"
Cohesion: 0.06
Nodes (53): AlgorithmPicker(), Props, Building(), FloorCalls, Props, ShaftProps, CarPanel(), Props (+45 more)

### Community 4 - "Minesweeper Board & Stats UI"
Cohesion: 0.06
Nodes (49): BoardTools(), Props, GenStats(), Props, FACE, Hud(), Props, Props (+41 more)

### Community 5 - "Boids Flocking Simulation"
Cohesion: 0.07
Nodes (57): DEFAULT_PARAMS, PRESETS, makeFlock(), placeFormation(), respawnAtEdge(), setVelocity(), Palette, readPalette() (+49 more)

### Community 6 - "Reaction-Diffusion Preview & Canvas"
Cohesion: 0.06
Nodes (42): fieldVerdict(), Preview(), Props, Props, RDCanvas, RDHandle, DEFAULT_PARAMS, RES_LEVELS (+34 more)

### Community 7 - "ACO Colony Engine"
Cohesion: 0.07
Nodes (40): Colony, DEFAULT_LAYOUT, DEFAULT_PARAMS, LAYOUTS, PARAM_RANGES, ParamRange, clusters(), generateCities() (+32 more)

### Community 8 - "Pac-Man AI Planning"
Cohesion: 0.12
Nodes (43): astar, buildTour(), coverage, computeThreatDist(), dangerField(), edibleGhostIds(), safestTile(), threatTiles() (+35 more)

### Community 9 - "L-System Editor & Canvas"
Cohesion: 0.08
Nodes (40): matchPreset(), Editor(), Props, build(), DEFAULT_VIEW, LCanvas, LHandle, Props (+32 more)

### Community 10 - "Pac-Man Maze Editor"
Cohesion: 0.09
Nodes (44): Brush, CONTENT, MazeEditor(), POP_CHARS, Props, randomizeContent(), SCAN_DELAY_MULT, TERRAIN (+36 more)

### Community 11 - "Pac-Man Maze Constants"
Cohesion: 0.08
Nodes (46): setPortalsFromState(), DIR_VEC, FRUIT_TILE, GATE_EXIT, GHOST_HOME, GHOST_POINTS, GHOST_START, MC_EVAL (+38 more)

### Community 12 - "Pac-Man Canvas & Input"
Cohesion: 0.10
Nodes (38): KEY_DIR, PacmanCanvas, PacmanHandle, Props, sirenLevel(), DIR_GLYPH, GHOST_NAME, PELLET_COLOR (+30 more)

### Community 13 - "About Page Terminal"
Cohesion: 0.08
Nodes (28): AboutTerminal(), CONFETTI, CONFETTI_GLYPHS, Entry, Props, ArgKind, buildCommands(), Command (+20 more)

### Community 14 - "Pac-Man BFS Pathfinding"
Cohesion: 0.10
Nodes (39): PathResult, bfsPath(), clamp(), NO_UP_TILES, TIE_ORDER, assignRoles(), distsToGhosts(), nearestPassable() (+31 more)

### Community 15 - "River Crossing Cast & Narrative"
Cohesion: 0.10
Nodes (36): Actor, buildRoster(), CANNIBAL_NAMES, chooseCrossers(), MISSIONARY_NAMES, Roster, mulberry32(), pick() (+28 more)

### Community 16 - "ACO & L-System Textbook Findings"
Cohesion: 0.06
Nodes (35): ACO Textbook, Ant Colony System (ACS, 1996), Ant System (AS, Dorigo 1992), HiDPI canvas backing-buffer feedback bug, Contrast-normalization rendering finding, Debug-bridge methodology (copyable report), Max-Min Ant System (MMAS), Pheromone update (evaporation + deposit + elitist) (+27 more)

### Community 17 - "Chess Move Generation"
Cohesion: 0.10
Nodes (30): addKingMoves(), addKnightMoves(), addPawnMoves(), addSlidingMoves(), ALL_DIRS, cloneBoard(), clonePosition(), DIAGS (+22 more)

### Community 18 - "River Crossing Solver"
Cohesion: 0.11
Nodes (21): assembleBidir(), boatLoads(), Came, floodCount(), Frame, FrontierOpts, isGoal(), isValid() (+13 more)

### Community 19 - "Chess Opening Book & Move Ordering"
Cohesion: 0.19
Nodes (25): lookupBookMove(), isEndgame(), getBestMove(), weightedPickIndex(), histKey(), isSameMove(), moveScore(), orderMoves() (+17 more)

### Community 20 - "N-Body Barnes-Hut Octree"
Cohesion: 0.13
Nodes (27): appendBody(), bhForces(), buildOctree(), childOf(), ForceSink, growNodes(), makeOctree(), newNode() (+19 more)

### Community 21 - "Shared Props/Config UI Bits"
Cohesion: 0.17
Nodes (23): Props, Props, Props, DEFAULT_CONFIG, SPEED_PRESETS, loadLabel(), moveArrow(), DebugEntry (+15 more)

### Community 22 - "Chess Evaluation Tables"
Cohesion: 0.14
Nodes (22): FUTILITY_MARGINS, PIECE_VALUE, PST, PST_KING_EG, evaluate(), isMatable(), KING_OFFSETS, kingRestriction() (+14 more)

### Community 23 - "N-Body Controls UI"
Cohesion: 0.13
Nodes (21): INTEGRATORS, COLOR_MODES, NBodyHandle, SegRow(), SegRowProps, DEFAULT_PARAMS, webgpuSupported(), COLOR_MODES (+13 more)

### Community 24 - "Experiment Page Entry Components"
Cohesion: 0.10
Nodes (22): Aco(), Boids(), CellularAutomata(), AlgoPanel(), AlgorithmSelect(), BreedingLab(), Run(), StoryPanel() (+14 more)

### Community 25 - "Shared UI Primitives"
Cohesion: 0.12
Nodes (14): ScrambleText(), Button(), ButtonVariant, Props, Props, Props, Props, Stat() (+6 more)

### Community 26 - "Pac-Man AI Graph Utils"
Cohesion: 0.14
Nodes (24): adj, build(), degree, dirBetweenIds(), dist, ensure(), firstDirIdx, gCost (+16 more)

### Community 27 - "N-Body Canvas & Camera"
Cohesion: 0.14
Nodes (19): DEFAULT_VIEW, NBodyCanvas, PointerState, mat4, multiply(), orbitView(), perspective(), projectToScreen() (+11 more)

### Community 28 - "Chess Opening Book Data"
Cohesion: 0.14
Nodes (16): book, OPENING_LINES, ClearRequest, ctx, SearchRequest, SearchResult, WorkerRequest, AI_DELAY (+8 more)

### Community 29 - "Chess AI Skill Levels"
Cohesion: 0.16
Nodes (17): GRADER_CONFIG, SKILL_LEVELS, SKILL_PIECES, SKILL_PRESETS, ChessGame(), GAME_MODES, isGameMode(), GameMode (+9 more)

### Community 30 - "Chess Board Constants"
Cohesion: 0.19
Nodes (16): FILES, PIECE_SORT, PIECE_VAL, RANKS, SYMBOLS, applyMove(), getGameStatus(), Piece (+8 more)

### Community 31 - "N-Body Preset Generators"
Cohesion: 0.20
Nodes (19): gauss(), genBelt(), genBinary(), genBlackHole(), genCloud(), genCluster(), genCollision(), genDisk() (+11 more)

### Community 32 - "Pac-Man Rendering"
Cohesion: 0.24
Nodes (19): center(), DIR_ANGLE, drawBoard(), drawDanger(), drawFruit(), drawGhost(), drawMaze(), drawOverlay() (+11 more)

### Community 33 - "Pac-Man Improvement Roadmap"
Cohesion: 0.12
Nodes (19): Pac-Man Improvement Roadmap, Coordinated/Communicating Ghosts, Framework-Free Engine Constraint, Maze Editor & Procedural Generator, Pac-Man AI Strategy Ladder, Pellet/Board-Content Registry Idea, Pac-Man Known Issues, Pac-Man Trademark/Licensing Posture (+11 more)

### Community 34 - "Chess AI Improvement Roadmap"
Cohesion: 0.15
Nodes (17): Chess AI Improvement Roadmap, Chess Programming Wiki references, Minimax + alpha-beta search, Move ordering (TT > MVV-LVA > killers > history), Pruning suite (NMP, futility, LMR, PVS), Transposition table, Chess AI Known Issues, Mop-up heuristic & king restriction (+9 more)

### Community 35 - "Gateway Card & Filter UI"
Cohesion: 0.21
Nodes (13): ExperimentCard(), Props, STATUS_CLS, FilterBar(), Props, STATUSES, StatusFilter, useScrambledText() (+5 more)

### Community 36 - "404 Page Terminal & Debris"
Cohesion: 0.17
Nodes (12): TERMINAL_LINES, Debris, DEBRIS_GLYPHS, DIGITS, lostTier(), NotFound(), MascotView, Mood (+4 more)

### Community 37 - "SEO Route Metadata"
Cohesion: 0.20
Nodes (12): RouteMeta(), author, enExperiments, experimentJsonLd(), experimentPages, homeJsonLd(), homePage, PageMeta (+4 more)

### Community 38 - "App Route Table"
Cohesion: 0.12
Nodes (16): About, Aco, Boids, CellularAutomata, ChessGame, Contact, Elevator, LSystem (+8 more)

### Community 39 - "Chess Pawn Structure Eval"
Cohesion: 0.22
Nodes (12): isPassed(), PASSED_BONUS, pawnStructureScore(), Board, Color, GameStatus, MoveFlag, PieceType (+4 more)

### Community 40 - "River Crossing Search Graph UI"
Cohesion: 0.17
Nodes (13): edgeKey(), SearchGraph(), XY, Stepper(), StepperProps, ALGO_BY_ID, AlgoKind, ALGOS (+5 more)

### Community 41 - "Experiment Header & Lang Toggle"
Cohesion: 0.20
Nodes (8): Crumb, ExperimentHeader(), Props, LangToggle(), Props, ThemeToggle(), Theme, Props

### Community 42 - "Homegrown i18n Engine"
Cohesion: 0.18
Nodes (12): Bundle, changeLanguage(), interpolate(), listeners, loaders, loadLocale(), lookup(), resolvePath() (+4 more)

### Community 43 - "N-Body Textbook Findings"
Cohesion: 0.15
Nodes (14): N-Body Gravity Textbook, Barnes-Hut Octree, Black Hole Capped Singularity, Individual/Block Timesteps & Regularization, Figure-8 Choreography, Symplectic Leapfrog Integrator, Plummer Softening, Solar System Moons Removed (Hill Sphere) (+6 more)

### Community 44 - "N-Body Debug Panel"
Cohesion: 0.23
Nodes (8): Props, compact(), NBodySnapshot, buildReport(), DebugPanel(), wrapDeg(), Props, Stats()

### Community 45 - "River Crossing Person & Scene UI"
Cohesion: 0.24
Nodes (9): Person(), PersonKind, Props, doomedBank(), people(), RiverScene(), RiverCrossing(), rightBank() (+1 more)

### Community 46 - "ScrambleText Component"
Cohesion: 0.32
Nodes (9): Props, effectiveDelayFor(), frameAt(), Options, randGlyph(), scrambled(), mql(), prefersReducedMotion() (+1 more)

### Community 47 - "N-Body WebGPU Solver"
Cohesion: 0.20
Nodes (8): createGpuSolver(), GpuSolver, StagingSlot, PresetDef, Bodies, Integrator, PresetId, View

### Community 48 - "PageSpeed Improvements Roadmap"
Cohesion: 0.23
Nodes (12): PageSpeed Improvement Roadmap, Route Code-Splitting & Self-Hosted Fonts, WCAG AA Contrast Fixes, font-display: optional CLS Fix, TBT Main-Thread Fixes (ScrambleText/Reflow), Web Performance Textbook, Accessibility is Contrast Math, Font-Swap Reflow CLS (+4 more)

### Community 49 - "Reaction-Diffusion Textbook Findings"
Cohesion: 0.18
Nodes (12): Float16 to float32 precision fix (RG16F to RG32F), GPU ping-pong float-texture simulation architecture, Gray-Scott reaction-diffusion model (U, V, feed/kill equations), Karl Sims' Gray-Scott tutorial convention (Du=1, Dv=0.5), Pearson's classification (1993) of the Gray-Scott (f,k) plane, presets.ts (eight f/k presets: spots, solitons, maze, mitosis, fingerprint, coral, worms, u-skate), resize() re-seed bug masquerading as always-near-empty, Headline finding: opposite seeds for the two regime families (+4 more)

### Community 50 - "River Crossing Improvement Roadmap"
Cohesion: 0.20
Nodes (11): Replay Decisions Not Result, Bidirectional BFS, River Crossing Improvement Roadmap, Bidirectional Illegal-Goal Gotcha, More Algorithms (Greedy/IDDFS/Bidir/UCS), Narrative Story Layer, Animate Search (Frontier/Explored), River Crossing Textbook (+3 more)

### Community 51 - "Minesweeper & Pac-Man AI Concepts"
Cohesion: 0.20
Nodes (10): Kaye 2000 - Minesweeper NP-complete, Tank Solver (Component Enumeration), Coordinated Ghost Blackboard, Greedy Local Movement Rule, Personality is Target Selection, Warden BFS Planner (Greedy Fails), Breadth-First Search, River Crossing A* (admissible h) (+2 more)

### Community 52 - "Pathfinding Textbook Findings"
Cohesion: 0.24
Nodes (10): Pathfinding Textbook, Heuristic Admissibility (weights >= 1), A* Search (Manhattan Heuristic), Depth-First Search, Dijkstra's Algorithm, Generator Snapshot Visualization, Greedy Best-First Search, Harabor & Grastien 2011 (JPS paper) (+2 more)

### Community 53 - "Minesweeper Solver Textbook"
Cohesion: 0.28
Nodes (9): Minesweeper Textbook, 3BV (Bechtel Board Benchmark Value), Exact Probability Under Global Budget, fullPropagate Pipeline, Single-Mine Hill-Climb Repair, No-Guess Generate-and-Test, Solver-as-Oracle Pattern, Seven Solver Engines (+1 more)

### Community 54 - "Brand Identity Assets"
Cohesion: 0.48
Nodes (7): Archive of Experiments Brand Identity, Favicon (32px favicon-safe bolt tile), App Icon (512px tile + bolt), Master Icon (full color tile + bolt), Master Icon 1024px Raster (WebP), Monochrome Icon (currentColor bolt), Lightning Bolt Mark (teal-to-purple gradient)

### Community 55 - "Elevator Known Issues & Textbook"
Cohesion: 0.38
Nodes (7): Elevator Scheduling Known Issues, Circular return as multi-tick express run, Car teleport bug (CSS-var transform never transitions), Elevator Scheduling Textbook, Disk metaphor is not a real directional elevator, Disk-scheduling algorithms (FCFS/SSTF/SCAN/LOOK/C-SCAN/C-LOOK), Idle-restart problem (stale direction)

### Community 56 - "i18n Locale Type System"
Cohesion: 0.50
Nodes (3): en, Translation, Widen

### Community 59 - "Static Asset Images"
Cohesion: 0.67
Nodes (3): Hero Illustration, Vite Logo, Vite

## Ambiguous Edges - Review These
- `Euclidean Traveling Salesman Problem` → `Uniform spatial hash grid`  [AMBIGUOUS]
  docs/boids/IMPROVEMENTS.md · relation: semantically_similar_to

## Knowledge Gaps
- **291 isolated node(s):** `STATUS_ORDER`, `DocWithVT`, `ChessGame`, `SortingVisualizer`, `Pathfinding` (+286 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Euclidean Traveling Salesman Problem` and `Uniform spatial hash grid`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `useTranslation()` connect `Experiment Page Entry Components` to `Pathfinding Search Algorithms`, `Cellular Automata Simulation Core`, `Minesweeper Solver Suite`, `Elevator Building & Algorithm UI`, `Minesweeper Board & Stats UI`, `Boids Flocking Simulation`, `Reaction-Diffusion Preview & Canvas`, `ACO Colony Engine`, `L-System Editor & Canvas`, `Pac-Man Maze Editor`, `Pac-Man Canvas & Input`, `About Page Terminal`, `Shared Props/Config UI Bits`, `N-Body Controls UI`, `Chess Opening Book Data`, `Chess AI Skill Levels`, `Gateway Card & Filter UI`, `404 Page Terminal & Debris`, `Chess Pawn Structure Eval`, `River Crossing Search Graph UI`, `Experiment Header & Lang Toggle`, `N-Body Debug Panel`, `River Crossing Person & Scene UI`?**
  _High betweenness centrality (0.653) - this node is a cross-community bridge._
- **Why does `SolverPanel()` connect `Minesweeper Solver Suite` to `Experiment Page Entry Components`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `MazeEditor()` connect `Pac-Man Maze Editor` to `Experiment Page Entry Components`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Are the 86 inferred relationships involving `useTranslation()` (e.g. with `About()` and `Aco()`) actually correct?**
  _`useTranslation()` has 86 INFERRED edges - model-reasoned connections that need verification._
- **What connects `STATUS_ORDER`, `DocWithVT`, `ChessGame` to the rest of the system?**
  _305 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Pathfinding Search Algorithms` be split into smaller, more focused modules?**
  _Cohesion score 0.052837938760268856 - nodes in this community are weakly interconnected._