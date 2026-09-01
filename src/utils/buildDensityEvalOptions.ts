import type { Node, Edge } from "@xyflow/react";
import type { EvaluationOptions } from "@/utils/densityEvaluator";
import {
  collectExternalImportedNames,
  ensureDensityExportsLoaded,
  resolveDensityExportsFromCache,
} from "@/utils/densityExportRegistry";
import { getDensityImportStatus } from "@/utils/previewPipelineSnapshot";
import { isPreviewWorkerLoggingEnabled, previewWorkerLog } from "@/utils/previewWorkerLog";

export interface BuildDensityEvalOptionsParams {
  nodes: Node[];
  edges: Edge[];
  contentFields?: Record<string, number>;
  /** SeedBox root. Omitted means an unseeded root, not "skip seeding". */
  worldSeed?: string;
  projectPath?: string | null;
  /** When false, only use already-cached exports (sync path). */
  loadMissing?: boolean;
  /** MaterialProvider section — merged for Imported density resolution only. */
  biomeSections?: Record<string, { nodes: Node[]; edges: Edge[] }> | null;
}

function mergeImportGraph(
  nodes: Node[],
  edges: Edge[],
  biomeSections?: Record<string, { nodes: Node[]; edges: Edge[] }> | null,
): { nodes: Node[]; edges: Edge[] } {
  const material = biomeSections?.MaterialProvider;
  if (!material || material.nodes.length === 0) return { nodes, edges };
  return {
    nodes: [...nodes, ...material.nodes],
    edges: [...edges, ...material.edges],
  };
}

/** Build evaluation options with resolved external Imported density exports. */
export async function buildDensityEvalOptions(
  params: BuildDensityEvalOptionsParams,
): Promise<EvaluationOptions> {
  const { nodes, edges, contentFields, worldSeed, projectPath, loadMissing = true, biomeSections } = params;
  const merged = mergeImportGraph(nodes, edges, biomeSections);
  const importNames = collectExternalImportedNames(merged.nodes, merged.edges);

  if (loadMissing && importNames.length > 0) {
    await ensureDensityExportsLoaded(importNames, projectPath ?? null);
  }

  const externalDensityExports = importNames.length > 0
    ? resolveDensityExportsFromCache(importNames)
    : undefined;

  if (isPreviewWorkerLoggingEnabled() && importNames.length > 0) {
    const status = getDensityImportStatus(nodes, edges);
    previewWorkerLog("evalOptions", "density imports", status);
  }

  return {
    contentFields,
    ...(worldSeed ? { worldSeed } : {}),
    ...(externalDensityExports && Object.keys(externalDensityExports).length > 0
      ? { externalDensityExports }
      : {}),
  };
}
