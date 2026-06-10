import type { Node, Edge } from "@xyflow/react";
import { computeGraphHash } from "./previewAutoFit";
import type { EvaluationOptions } from "./densityEvaluator";
import { collectExternalImportedNames } from "./densityExportRegistry";

/** Stable key for reusing eval context across progressive volume passes. */
export function computeVolumeSessionKey(
  nodes: Node[],
  edges: Edge[],
  rootNodeId: string | undefined,
  options?: EvaluationOptions,
): string {
  const graph = computeGraphHash(nodes, edges);
  const root = rootNodeId ?? "";
  const content = options?.contentFields ? JSON.stringify(options.contentFields) : "";
  const importNames = collectExternalImportedNames(nodes, edges).join(",");
  const resolvedImports = options?.externalDensityExports
    ? Object.keys(options.externalDensityExports).sort().join(",")
    : "";
  return `${graph}|${root}|${content}|imp:${importNames}|resolved:${resolvedImports}`;
}

/** Cache key for a completed voxel mesh (graph + preview volume params). */
export function computeVoxelEvalKey(params: {
  evalFingerprint: string;
  rangeMin: number;
  rangeMax: number;
  yLevel: number;
  voxelYMin: number;
  voxelYMax: number;
  voxelYSlices: number;
  targetRes: number;
  showMaterialColors: boolean;
}): string {
  return [
    params.evalFingerprint,
    `rng:${params.rangeMin},${params.rangeMax}`,
    `yl:${params.yLevel}`,
    `vy:${params.voxelYMin},${params.voxelYMax}`,
    `vs:${params.voxelYSlices}`,
    `res:${params.targetRes}`,
    `mat:${params.showMaterialColors ? 1 : 0}`,
  ].join("|");
}
