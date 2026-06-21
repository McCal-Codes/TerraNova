import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "node:fs";
import { visualizer } from "rollup-plugin-visualizer";
import { hytaleDevCachePlugin } from "./scripts/vite-hytale-dev-cache-plugin";

const host = process.env.TAURI_DEV_HOST;
const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as { version?: string };
const appVersion = packageJson.version ?? "0.0.0";

export default defineConfig({
  // Disable Fast Refresh to avoid HMR incompatibility warnings during
  // development. This is a temporary workaround — consider refactoring
  // re-exports from component modules to fix the underlying cause.
  plugins: [
    react({ fastRefresh: false }),
    hytaleDevCachePlugin(),
    // Run `ANALYZE=1 npm run build` to generate dist/stats.html
    process.env.ANALYZE ? visualizer({ open: true, filename: "dist/stats.html", gzipSize: true }) : null,
  ].filter(Boolean),
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  worker: {
    format: "es",
  },
  build: {
    minify: "esbuild",
    cssMinify: true,
    target:
      process.env.TAURI_ENV_PLATFORM === "windows"
        ? "chrome105"
        : process.env.TAURI_ENV_PLATFORM === "macos"
          ? "safari13"
          : "chrome105",
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks: {
          vendor: ["react", "react-dom", "zustand"],
          three: ["three", "@react-three/fiber", "@react-three/drei", "@react-three/postprocessing", "postprocessing"],
          xyflow: ["@xyflow/react"],
          mermaid: ["mermaid"],
          codemirror: ["codemirror", "@codemirror/view", "@codemirror/state", "@codemirror/lang-json", "@codemirror/lint", "@codemirror/theme-one-dark"],
          markdown: ["react-markdown", "remark-gfm", "rehype-slug", "rehype-highlight", "highlight.js"],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["@dagrejs/dagre", "@dagrejs/graphlib"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
