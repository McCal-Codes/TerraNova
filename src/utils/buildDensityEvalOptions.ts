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
  projectPath?: string | null;
  /** When false, only use already-cached exports (sync path). */
  loadMissing?: boolean;
}

/** Build evaluation options with resolved external Imported density exports. */
export async function buildDensityEvalOptions(
  params: BuildDensityEvalOptionsParams,
): Promise<EvaluationOptions> {
  const { nodes, edges, contentFields, projectPath, loadMissing = true } = params;
  const importNames = collectExternalImportedNames(nodes, edges);

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
    ...(externalDensityExports && Object.keys(externalDensityExports).length > 0
      ? { externalDensityExports }
      : {}),
  };
}
