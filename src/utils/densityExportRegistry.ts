import type { Node, Edge } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { normalizeImport } from "@/utils/fileTypeDetection";
import { getHytaleAssetCacheRoot, listDirectory, readAssetFile, pathExists } from "@/utils/ipc";

export interface DensityExportGraph {
  nodes: Node[];
  edges: Edge[];
}

export type DensityExportMap = Record<string, DensityExportGraph>;

const bundledDensityModules = import.meta.glob(
  [
    "../../../templates/**/HytaleGenerator/Density/**/*.json",
    "../../../templates/references/**/*.json",
  ],
  { eager: true, import: "default" },
) as Record<string, unknown>;

function nodeFields(node: Node): Record<string, unknown> {
  return ((node.data as Record<string, unknown>)?.fields as Record<string, unknown>) ?? {};
}

/** Imported nodes with no wired Input — resolve Name from external density exports. */
export function collectExternalImportedNames(
  nodes: Node[] | null | undefined,
  edges: Edge[] | null | undefined,
): string[] {
  const nodeList = Array.isArray(nodes) ? nodes : [];
  const edgeList = Array.isArray(edges) ? edges : [];
  const wiredInput = new Set<string>();
  for (const edge of edgeList) {
    const handle = edge.targetHandle ?? "Input";
    if (handle === "Input" || handle.startsWith("Inputs")) {
      wiredInput.add(edge.target);
    }
  }

  const names = new Set<string>();
  for (const node of nodeList) {
    const type = getNodeType(node);
    if (type !== "Imported" && type !== "ImportedValue") continue;
    if (wiredInput.has(node.id)) continue;
    const name = String(nodeFields(node).Name ?? nodeFields(node).ExportAs ?? "").trim();
    if (name) names.add(name);
  }
  return [...names];
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

function densityJsonToGraph(json: Record<string, unknown>, idPrefix: string): DensityExportGraph {
  const internal = normalizeImport(json);
  return jsonToGraph(internal, 0, 0, idPrefix);
}

function indexJsonFile(
  json: unknown,
  fileKey: string,
  out: Map<string, DensityExportGraph>,
): void {
  if (!json || typeof json !== "object" || Array.isArray(json)) return;
  const record = json as Record<string, unknown>;

  const byExportAs = new Map<string, Record<string, unknown>>();
  walkCollectExports(record, byExportAs);

  const stem = fileKey.replace(/\\/g, "/").split("/").pop()?.replace(/\.json$/i, "") ?? "";
  if (stem && typeof record.Type === "string" && !byExportAs.has(stem)) {
    byExportAs.set(stem, extractExportBody(record));
  }

  for (const [name, body] of byExportAs) {
    if (!name || out.has(name)) continue;
    if (!body.Type) continue;
    try {
      out.set(name, densityJsonToGraph(body, `ext_${name}`));
    } catch {
      // skip malformed export bodies
    }
  }
}

function buildBundledExportIndex(): Map<string, DensityExportGraph> {
  const out = new Map<string, DensityExportGraph>();
  for (const [modulePath, json] of Object.entries(bundledDensityModules)) {
    const fileKey = modulePath.replace(/\\/g, "/").replace("../../../templates/", "");
    indexJsonFile(json, fileKey, out);
  }
  return out;
}

const bundledExportIndex = buildBundledExportIndex();
const runtimeExportIndex = new Map<string, DensityExportGraph>(bundledExportIndex);
const pendingLoads = new Map<string, Promise<void>>();

export function getRegisteredDensityExportNames(): string[] {
  return [...runtimeExportIndex.keys()].sort();
}

export function resolveDensityExportsFromCache(names: string[]): DensityExportMap {
  const out: DensityExportMap = {};
  for (const name of names) {
    const graph = runtimeExportIndex.get(name);
    if (graph) out[name] = graph;
  }
  return out;
}

async function tryLoadDensityFile(absolutePath: string, exportName: string): Promise<boolean> {
  try {
    if (!(await pathExists(absolutePath))) return false;
    const json = await readAssetFile(absolutePath);
    if (!json || typeof json !== "object" || Array.isArray(json)) return false;
    const scratch = new Map<string, DensityExportGraph>();
    indexJsonFile(json, `${exportName}.json`, scratch);
    const graph = scratch.get(exportName) ?? scratch.values().next().value;
    if (!graph) return false;
    runtimeExportIndex.set(exportName, graph);
    return true;
  } catch {
    return false;
  }
}

async function loadExportFromDisk(exportName: string, projectPath: string | null): Promise<void> {
  const rel = `Server/HytaleGenerator/Density/${exportName}.json`;

  if (projectPath) {
    const projectFile = `${projectPath.replace(/\\/g, "/")}/${rel}`;
    if (await tryLoadDensityFile(projectFile, exportName)) return;
  }

  try {
    const cacheRoot = await getHytaleAssetCacheRoot();
    const cacheFile = `${cacheRoot.replace(/\\/g, "/")}/${rel}`;
    if (await tryLoadDensityFile(cacheFile, exportName)) return;
  } catch {
    // hytale cache unavailable (browser dev)
  }
}

/** Load missing density exports from project pack or synced hytale-assets cache. */
export async function ensureDensityExportsLoaded(
  names: string[],
  projectPath?: string | null,
): Promise<void> {
  const missing = names.filter((n) => n && !runtimeExportIndex.has(n));
  if (missing.length === 0) return;

  await Promise.all(missing.map(async (name) => {
    if (runtimeExportIndex.has(name)) return;
    let pending = pendingLoads.get(name);
    if (!pending) {
      pending = loadExportFromDisk(name, projectPath ?? null).finally(() => {
        pendingLoads.delete(name);
      });
      pendingLoads.set(name, pending);
    }
    await pending;
  }));
}

/** Scan synced hytale-assets Density folder filenames (no file reads). */
export async function listCachedDensityExportNames(): Promise<string[]> {
  try {
    const cacheRoot = await getHytaleAssetCacheRoot();
    const dir = `${cacheRoot.replace(/\\/g, "/")}/Server/HytaleGenerator/Density`;
    if (!(await pathExists(dir))) return [];
    const entries = await listDirectory(dir);
    return entries
      .filter((e) => !e.is_dir && e.name.toLowerCase().endsWith(".json"))
      .map((e) => e.name.replace(/\.json$/i, ""))
      .sort();
  } catch {
    return [];
  }
}

export function clearRuntimeDensityExportCache(): void {
  runtimeExportIndex.clear();
  for (const [k, v] of bundledExportIndex) runtimeExportIndex.set(k, v);
}
