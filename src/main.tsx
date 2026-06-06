import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./i18n";
import "./index.css";
import App from "./App";
import RouteMeta from "./seo/RouteMeta";
import ChessGame from "./experiments/chess";
import Pathfinding from "./experiments/pathfinding";
import Elevator from "./experiments/elevator";
import Aco from "./experiments/aco";
import RiverCrossing from "./experiments/river-crossing";
import Minesweeper from "./experiments/minesweeper";
import NotFound from "./components/NotFound";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <RouteMeta />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/experiments/chess/:mode?" element={<ChessGame />} />
        <Route path="/experiments/pathfinding/:screen?" element={<Pathfinding />} />
        <Route path="/experiments/elevator" element={<Elevator />} />
        <Route path="/experiments/aco" element={<Aco />} />
        <Route path="/experiments/river-crossing" element={<RiverCrossing />} />
        <Route path="/experiments/minesweeper" element={<Minesweeper />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
