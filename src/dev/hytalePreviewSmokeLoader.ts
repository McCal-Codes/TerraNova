import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Edge, Node } from "@xyflow/react";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { normalizeImport } from "@/utils/fileTypeDetection";
import type { BiomeMaterialConfig } from "@/utils/materialResolver";
import {
  type DensityExportMap,
} from "@/utils/densityExportRegistry";
import { parseContentFieldsFromWorldStructure } from "@/utils/terrainPreviewLevel";
import { analyzeGraphPreviewFeatures } from "@/utils/graphPreviewFeatures";
import { getNodeType } from "@/utils/density/evalTypes";
import { biomeGraphFromBiome } from "@/utils/biomePreviewGraph";

/** Release Hytale biomes used for cave/river preview smoke (synced hytale-assets cache). */
export { HYTALE_SMOKE_BIOMES, type HytaleSmokeBiomeId, type HytaleGallerySmokeBiomeId } from "./hytalePreviewSmokePaths";

export function resolveHytaleCacheRoot(): string | null {
  const envRecord = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  const env = envRecord?.TERRANOVA_HYTALE_CACHE?.trim();
  if (env && existsSync(env)) return env;

  // Mirror the Rust resolver (io::hytale_assets::default_hytale_assets_root):
  // the synced cache normally sits at the repo root, and tests may run from
  // either the repo root or src-tauri. Checking these first is what makes the
  // suite run on macOS and Linux at all — the LOCALAPPDATA branch below is
  // Windows-only, so without them `resolveHytaleCacheRoot` returned null and
  // every Hytale smoke test silently skipped while still reporting green.
  const cwd = (globalThis as { process?: { cwd?: () => string } }).process?.cwd?.();
  if (cwd) {
    for (const candidate of [
      path.join(cwd, "hytale-assets"),
      path.join(cwd, "..", "hytale-assets"),
    ]) {
      if (existsSync(candidate)) return candidate;
    }
  }

  const local = envRecord?.LOCALAPPDATA;
  if (local) {
    const defaultRoot = path.join(local, "TerraNova", "hytale-assets");
    if (existsSync(defaultRoot)) return defaultRoot;
  }

  return null;
}

function extractExportBody(record: Record<string, unknown>): Record<string, unknown> {
  if (record.Type === "Exported") {
    const input = record.Input
      ?? (Array.isArray(record.Inputs) && record.Inputs.length > 0 ? record.Inputs[0] : null);
    if (input && typeof input === "object" && !Array.isArray(input)) {
      return input as Record<string, unknown>;
    }
  }
  return record;
}

function densityExportFromJson(json: Record<string, unknown>, idPrefix: string) {
  const body = typeof json.Type === "string" ? extractExportBody(json) : json;
  return jsonToGraph(normalizeImport(body), 0, 0, idPrefix);
}

export function loadBiomeJsonSync(cacheRoot: string, relativePath: string): Record<string, unknown> {
  const file = path.join(cacheRoot, relativePath.replace(/\//g, path.sep));
  return JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
}

function walkCollectExports(
  value: unknown,
  out: Map<string, Record<string, unknown>>,
): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walkCollectExports(item, out);
    return;
  }
  const record = value as Record<string, unknown>;
  const exportAs = typeof record.ExportAs === "string" ? record.ExportAs.trim() : "";
  if (exportAs && typeof record.Type === "string") {
    out.set(exportAs, extractExportBody(record));
  }
  for (const child of Object.values(record)) walkCollectExports(child, out);
}

function densityExportFromNamedBody(name: string, body: Record<string, unknown>) {
  return jsonToGraph(normalizeImport(body), 0, 0, `smoke_${name}`);
}

function loadSingleDensityExport(cacheRoot: string, name: string) {
  const direct = path.join(
    cacheRoot,
    "Server/HytaleGenerator/Density",
    `${name}.json`,
  );
  if (existsSync(direct)) {
    const json = JSON.parse(readFileSync(direct, "utf-8")) as Record<string, unknown>;
    return densityExportFromJson(json, `smoke_${name}`);
  }

  const densityDir = path.join(cacheRoot, "Server/HytaleGenerator/Density");
  if (!existsSync(densityDir)) return null;

  for (const file of readdirSync(densityDir)) {
    if (!file.toLowerCase().endsWith(".json")) continue;
    const filePath = path.join(densityDir, file);
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
    } catch {
      continue;
    }

    const byExport = new Map<string, Record<string, unknown>>();
    walkCollectExports(json, byExport);

    const stem = file.replace(/\.json$/i, "");
    if (!byExport.has(stem) && typeof json.Type === "string") {
      byExport.set(stem, extractExportBody(json));
    }

    const body = byExport.get(name);
    if (body?.Type) {
      return densityExportFromNamedBody(name, body);
    }
  }

  return null;
}

export function loadDensityExportsSync(cacheRoot: string, names: string[]): DensityExportMap {
  const out: DensityExportMap = {};
  for (const name of names) {
    const graph = loadSingleDensityExport(cacheRoot, name);
    if (graph) out[name] = graph;
  }
  return out;
}

export function discoverContentFieldsSync(
  cacheRoot: string,
  biomeRelativePath: string,
): Record<string, number> {
  const wsDir = path.join(cacheRoot, "Server/HytaleGenerator/WorldStructures");
  const mainWorld = path.join(wsDir, "MainWorld.json");
  if (existsSync(mainWorld)) {
    try {
      const ws = JSON.parse(readFileSync(mainWorld, "utf-8")) as Record<string, unknown>;
      const fields = parseContentFieldsFromWorldStructure(ws);
      if (Object.keys(fields).length > 0) return fields;
    } catch {
      // fall through
    }
  }

  void biomeRelativePath;
  return { Base: 64, Water: 64, Bedrock: 0 };
}

export interface HytaleTerrainSetup {
  nodes: Node[];
  edges: Edge[];
  outputNodeId: string | null;
  materialConfig: BiomeMaterialConfig | null;
  contentFields: Record<string, number>;
  features: ReturnType<typeof analyzeGraphPreviewFeatures>;
  externalDensityExports: DensityExportMap;
}

export function buildHytaleTerrainSetup(
  biome: Record<string, unknown>,
  cacheRoot: string,
  biomeRelativePath: string,
): HytaleTerrainSetup {
  const graph = biomeGraphFromBiome(biome);
  const { nodes, edges, outputNodeId, materialConfig } = graph;
  const contentFields = discoverContentFieldsSync(cacheRoot, biomeRelativePath);
  const externalDensityExports = loadDensityExportsSync(cacheRoot, graph.importNames);
  const features = analyzeGraphPreviewFeatures(
    nodes,
    edges,
    contentFields,
    materialConfig,
  );

  return {
    nodes,
    edges,
    outputNodeId,
    materialConfig,
    contentFields,
    features,
    externalDensityExports,
  };
}

export function findTerrainOutputNode(nodes: Node[]): string | null {
  const mix = nodes.filter((n) => getNodeType(n) === "Mix");
  if (mix.length > 0) return mix[mix.length - 1]!.id;
  return nodes.length > 0 ? nodes[nodes.length - 1]!.id : null;
}

/** True when a column has solid surface and air/void below (cave-like). */
export function volumeHasSubsurfaceVoids(
  densities: Float32Array,
  resolution: number,
  ySlices: number,
): boolean {
  const n = resolution;
  for (let zi = 0; zi < n; zi++) {
    for (let xi = 0; xi < n; xi++) {
      let sawSolid = false;
      let sawVoidBelowSolid = false;
      for (let yi = ySlices - 1; yi >= 0; yi--) {
        const d = densities[yi * n * n + zi * n + xi];
        if (d >= 0) {
          if (sawVoidBelowSolid) return true;
          sawSolid = true;
        } else if (sawSolid) {
          sawVoidBelowSolid = true;
        }
      }
    }
  }
  return false;
}

export function countDensitySignBuckets(densities: Float32Array): {
  negative: number;
  nonNegative: number;
} {
  let negative = 0;
  let nonNegative = 0;
  for (let i = 0; i < densities.length; i++) {
    if (densities[i] < 0) negative++;
    else nonNegative++;
  }
  return { negative, nonNegative };
}
