import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./i18n";
import "./index.css";
import App from "./App";
import ChessGame from "./experiments/chess";
import Pathfinding from "./experiments/pathfinding";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/experiments/chess" element={<ChessGame />} />
        <Route path="/experiments/pathfinding" element={<Pathfinding />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
