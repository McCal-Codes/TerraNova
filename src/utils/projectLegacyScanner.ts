import type { Node } from "@xyflow/react";
import {
  getDeprecationTier,
  getLegacyReplacement,
  isDeprecatedOrLegacyTypeKey,
  type DeprecationTier,
} from "@/nodes/shared/legacyTypes";
import { resolveImportNodeType } from "@/utils/jsonToGraph";
import { normalizePath } from "@/utils/pathUtils";

export interface ProjectLegacyHit {
  file: string;
  nodeId: string | null;
  typeKey: string;
  bareType: string;
  tier: DeprecationTier;
  replacement: string | null;
}

function collectLegacyHitsFromValue(
  value: unknown,
  file: string,
  parentFieldName: string | undefined,
  hits: ProjectLegacyHit[],
): void {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectLegacyHitsFromValue(item, file, parentFieldName, hits);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.Type === "string") {
    const typeKey = resolveImportNodeType(record.Type, parentFieldName);
    const tier = getDeprecationTier(typeKey);
    if (tier !== "active") {
      hits.push({
        file,
        nodeId: typeof record.$NodeId === "string" ? record.$NodeId : null,
        typeKey,
        bareType: record.Type,
        tier,
        replacement: getLegacyReplacement(typeKey),
      });
    }
  }

  for (const [fieldName, child] of Object.entries(record)) {
    if (fieldName === "Type" || fieldName === "$NodeId") continue;
    collectLegacyHitsFromValue(child, file, fieldName, hits);
  }
}

function getEditorNodeBareType(node: Node): string {
  return (node.data as { type?: string } | undefined)?.type ?? "";
}

/** Scan in-memory editor nodes for legacy / deprecated types (open file). */
export function scanEditorNodesForLegacyHits(filePath: string, nodes: Node[]): ProjectLegacyHit[] {
  const hits: ProjectLegacyHit[] = [];
  for (const node of nodes) {
    if (!node) continue;
    const bareType = getEditorNodeBareType(node);
    const typeKey = node.type ?? bareType;
    if (!typeKey || !isDeprecatedOrLegacyTypeKey(typeKey)) continue;
    hits.push({
      file: filePath,
      nodeId: node.id,
      typeKey,
      bareType,
      tier: getDeprecationTier(typeKey),
      replacement: getLegacyReplacement(typeKey),
    });
  }
  return hits;
}

function sortLegacyHits(hits: ProjectLegacyHit[]): ProjectLegacyHit[] {
  return [...hits].sort((a, b) => {
    const fileCmp = a.file.localeCompare(b.file);
    if (fileCmp !== 0) return fileCmp;
    return (a.nodeId ?? a.typeKey).localeCompare(b.nodeId ?? b.typeKey);
  });
}

/** Replace disk hits for one file with editor-derived hits (unsaved open file). */
export function overlayEditorHitsForFile(
  hits: ProjectLegacyHit[],
  filePath: string,
  editorHits: ProjectLegacyHit[],
): ProjectLegacyHit[] {
  const key = normalizePath(filePath).toLowerCase();
  const otherHits = hits.filter((hit) => normalizePath(hit.file).toLowerCase() !== key);
  return sortLegacyHits([...otherHits, ...editorHits]);
}

/** Scan a parsed Hytale generator JSON tree for legacy or deprecated node types. */
export function scanJsonForLegacyNodes(filePath: string, json: unknown): ProjectLegacyHit[] {
  const hits: ProjectLegacyHit[] = [];
  collectLegacyHitsFromValue(json, filePath, undefined, hits);
  return hits;
}

const GENERATOR_PATH_SEGMENT = `${"Server"}${"/"}${"HytaleGenerator"}${"/"}`;

/** True when the asset path is under Server/HytaleGenerator. */
export function isHytaleGeneratorAssetPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.includes(GENERATOR_PATH_SEGMENT) && normalized.endsWith(".json");
}

/**
 * Scan all generator JSON files in a project for legacy / deprecated nodes.
 */
export async function scanProjectForLegacyNodes(
  assetFiles: string[],
  readFile: (path: string) => Promise<unknown>,
): Promise<ProjectLegacyHit[]> {
  const generatorFiles = assetFiles.filter(isHytaleGeneratorAssetPath);
  const hits: ProjectLegacyHit[] = [];

  for (const file of generatorFiles) {
    try {
      const json = await readFile(file);
      hits.push(...scanJsonForLegacyNodes(file, json));
    } catch {
      // Skip unreadable files — validation panel shows scan errors separately if needed.
    }
  }

  return sortLegacyHits(hits);
}

/** Group hits by file path for Validation panel display. */
export function groupLegacyHitsByFile(
  hits: ProjectLegacyHit[],
): Map<string, ProjectLegacyHit[]> {
  const grouped = new Map<string, ProjectLegacyHit[]>();
  for (const hit of hits) {
    const list = grouped.get(hit.file) ?? [];
    list.push(hit);
    grouped.set(hit.file, list);
  }
  return grouped;
}

export function formatLegacyHitLabel(hit: ProjectLegacyHit): string {
  const idPart = hit.nodeId ? `${hit.nodeId}: ` : "";
  const replacement = hit.replacement ? ` → ${hit.replacement}` : "";
  return `${idPart}${hit.typeKey} (${hit.tier})${replacement}`;
}
