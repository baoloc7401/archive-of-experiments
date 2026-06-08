import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./i18n";
import "./index.css";
import RouteMeta from "./seo/RouteMeta";
import AppRoutes from "./AppRoutes";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <RouteMeta />
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>
);
