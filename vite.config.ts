import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { seoPlugin } from "./scripts/vite-seo";

export default defineConfig({
  base: "/archive-of-experiments/",
  plugins: [react(), seoPlugin()],
});
