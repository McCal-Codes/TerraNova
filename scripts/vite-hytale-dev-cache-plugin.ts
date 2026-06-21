import type { Plugin } from "vite";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function resolveHytaleCacheRoot(): string | null {
  const env = process.env.TERRANOVA_HYTALE_CACHE?.trim();
  if (env && existsSync(env)) return env;

  const local = process.env.LOCALAPPDATA;
  if (!local) return null;

  const defaultRoot = path.join(local, "TerraNova", "hytale-assets");
  return existsSync(defaultRoot) ? defaultRoot : null;
}

/**
 * DEV-only: serve synced hytale-assets over HTTP for the shape preview gallery.
 * GET /dev/hytale-cache/Server/HytaleGenerator/Biomes/Plains1/Plains1_River.json
 */
export function hytaleDevCachePlugin(): Plugin {
  return {
    name: "terranova-hytale-dev-cache",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const prefix = "/dev/hytale-cache/";
        if (!url.startsWith(prefix)) {
          next();
          return;
        }

        const rel = decodeURIComponent(url.slice(prefix.length).split("?")[0] ?? "");
        if (!rel || rel.includes("..")) {
          res.statusCode = 400;
          res.end("Invalid path");
          return;
        }

        const cacheRoot = resolveHytaleCacheRoot();
        if (!cacheRoot) {
          res.statusCode = 503;
          res.end("Hytale asset cache not found — run Settings → Sync Hytale assets or pnpm sync:hytale");
          return;
        }

        const file = path.join(cacheRoot, rel.replace(/\//g, path.sep));
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }

        try {
          const body = readFileSync(file, "utf-8");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.statusCode = 200;
          res.end(body);
        } catch {
          res.statusCode = 500;
          res.end("Read failed");
        }
      });
    },
  };
}
