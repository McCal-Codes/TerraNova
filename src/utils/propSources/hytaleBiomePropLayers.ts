import type { Edge, Node } from "@xyflow/react";

import { buildPropSectionGraph } from "@/utils/propSectionAssets";

export interface HytaleBiomePropLayer {
  index: number;
  runtime: number;
  skip: boolean;
  summary: string;
  positionType: string | null;
  assignmentType: string | null;
  rootType: string | null;
  prefabPaths: string[];
  importedNames: string[];
  rawPropEntry: Record<string, unknown>;
}

function readType(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const type = (value as Record<string, unknown>).Type;
  return typeof type === "string" ? type : null;
}

/** Hytale type family before the variant suffix (e.g. PropDistribution:Constant → PropDistribution). */
function readTypeFamily(value: unknown): string | null {
  const type = readType(value);
  if (!type) return null;
  const colon = type.indexOf(":");
  return colon >= 0 ? type.slice(0, colon) : type;
}

function basenameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function collectPrefabPaths(value: unknown, paths: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectPrefabPaths(item, paths);
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.Path === "string" && record.Path.trim()) {
    paths.add(record.Path.trim());
  }
  if (Array.isArray(record.WeightedPrefabPaths)) {
    for (const entry of record.WeightedPrefabPaths) {
      if (entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).Path === "string") {
        paths.add(String((entry as Record<string, unknown>).Path));
      }
    }
  }
  for (const child of Object.values(record)) {
    collectPrefabPaths(child, paths);
  }
}

function collectImportedNames(value: unknown, names: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectImportedNames(item, names);
    return;
  }
  const record = value as Record<string, unknown>;
  const type = readType(record);
  if (type?.includes("Imported") && typeof record.Name === "string") {
    names.add(record.Name);
  }
  for (const child of Object.values(record)) {
    collectImportedNames(child, names);
  }
}

/** Summarize Props[i] layers from an internal or Hytale biome wrapper. */
export function listHytaleBiomePropLayers(
  wrapper: Record<string, unknown>,
): HytaleBiomePropLayer[] {
  const props = wrapper.Props;
  if (!Array.isArray(props)) return [];

  return props.map((entry, index) => {
    const prop = (entry ?? {}) as Record<string, unknown>;
    const dist = prop.PropDistribution as Record<string, unknown> | undefined;
    const positions = (prop.Positions ?? dist?.Positions) as Record<string, unknown> | undefined;
    const assignments = (prop.Assignments ?? dist?.Assignments ?? dist?.Prop) as
      | Record<string, unknown>
      | undefined;

    const positionType = readType(positions);
    const assignmentType = readType(assignments);
    const rootType =
      dist != null
        ? "PropDistribution"
        : positions && assignments
          ? "Flat"
          : readTypeFamily(positions) ?? readTypeFamily(assignments);

    const distributionVariant = dist ? readType(dist) : null;

    const prefabPaths = new Set<string>();
    const importedNames = new Set<string>();
    collectPrefabPaths(prop, prefabPaths);
    collectImportedNames(prop, importedNames);

    const rootSummary = dist != null
      ? distributionVariant
        ? `PropDistribution · ${distributionVariant}`
        : "PropDistribution"
      : null;

    const parts = [
      rootSummary,
      positionType ? `pos ${positionType}` : null,
      assignmentType ? `asgn ${assignmentType}` : null,
      importedNames.size > 0 ? `import ${[...importedNames][0]}` : null,
      prefabPaths.size > 0
        ? `prefab ${basenameFromPath([...prefabPaths][0])}`
        : null,
    ].filter(Boolean);

    return {
      index,
      runtime: typeof prop.Runtime === "number" ? prop.Runtime : 0,
      skip: Boolean(prop.Skip),
      summary: parts.join(" · ") || "Prop layer",
      positionType,
      assignmentType,
      rootType,
      prefabPaths: [...prefabPaths],
      importedNames: [...importedNames],
      rawPropEntry: prop,
    };
  });
}

export function buildPropSectionFromEntry(
  propEntry: Record<string, unknown>,
  idPrefix: string,
): { nodes: Node[]; edges: Edge[] } {
  const graph = buildPropSectionGraph(propEntry, idPrefix);
  return { nodes: graph.nodes, edges: graph.edges };
}
