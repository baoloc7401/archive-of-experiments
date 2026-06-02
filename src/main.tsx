import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./i18n";
import "./index.css";
import App from "./App";
import ChessGame from "./experiments/chess";
import Pathfinding from "./experiments/pathfinding";
import Elevator from "./experiments/elevator";
import Aco from "./experiments/aco";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/experiments/chess" element={<ChessGame />} />
        <Route path="/experiments/pathfinding" element={<Pathfinding />} />
        <Route path="/experiments/elevator" element={<Elevator />} />
        <Route path="/experiments/aco" element={<Aco />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
