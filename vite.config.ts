import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { seoPlugin } from "./scripts/vite-seo";

const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as {
  version: string;
};

export default defineConfig({
  base: "/archive-of-experiments/",
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react(), seoPlugin()],
});
