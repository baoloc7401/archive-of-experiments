import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import App from "./App";

// The gateway (App) and NotFound stay eager - everything below is loaded
// per route so the landing page ships only the gateway plus the router.
// Each lazy import becomes its own chunk (JS + CSS) emitted by Vite.
const ChessGame = lazy(() => import("./experiments/chess"));
const SortingVisualizer = lazy(() => import("./experiments/sorting-visualizer"));
const Pathfinding = lazy(() => import("./experiments/pathfinding"));
const Elevator = lazy(() => import("./experiments/elevator"));
const Aco = lazy(() => import("./experiments/aco"));
const RiverCrossing = lazy(() => import("./experiments/river-crossing"));
const Minesweeper = lazy(() => import("./experiments/minesweeper"));
const Pacman = lazy(() => import("./experiments/pacman"));
const Boids = lazy(() => import("./experiments/boids"));
const LSystem = lazy(() => import("./experiments/l-system"));
const CellularAutomata = lazy(() => import("./experiments/cellular-automata"));
const NBody = lazy(() => import("./experiments/n-body"));
const ReactionDiffusion = lazy(() => import("./experiments/reaction-diffusion"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const NotFound = lazy(() => import("./components/NotFound"));

// Non-text placeholder while a route chunk loads. Holds the viewport so a
// deep-linked experiment shows the page background instead of a blank flash;
// no layout shift (keeps CLS at 0), no user-facing string to translate.
const routeFallback = <div className="route-fallback" aria-hidden="true" />;

export default function AppRoutes() {
  return (
    <Suspense fallback={routeFallback}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/experiments/chess/:mode?" element={<ChessGame />} />
        <Route path="/experiments/sorting-visualizer" element={<SortingVisualizer />} />
        <Route path="/experiments/pathfinding/:screen?" element={<Pathfinding />} />
        <Route path="/experiments/elevator" element={<Elevator />} />
        <Route path="/experiments/aco" element={<Aco />} />
        <Route path="/experiments/river-crossing" element={<RiverCrossing />} />
        <Route path="/experiments/minesweeper" element={<Minesweeper />} />
        <Route path="/experiments/pacman" element={<Pacman />} />
        <Route path="/experiments/boids" element={<Boids />} />
        <Route path="/experiments/l-system" element={<LSystem />} />
        <Route path="/experiments/cellular-automata" element={<CellularAutomata />} />
        <Route path="/experiments/n-body" element={<NBody />} />
        <Route path="/experiments/reaction-diffusion" element={<ReactionDiffusion />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
