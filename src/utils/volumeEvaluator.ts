import type { Node, Edge } from "@xyflow/react";
import { createEvaluationContext, type EvaluationOptions } from "./densityEvaluator";
import { evaluateDensityGrid3D, type VolumeGridParams, type VolumeGridResult } from "./volumeEvaluationCore";

export type { VolumeGridParams, VolumeGridResult };
export { evaluateDensityGrid3D, progressiveYSlices, buildProgressiveVolumeSteps } from "./volumeEvaluationCore";

/* ── Types ────────────────────────────────────────────────────────── */

export interface VolumeResult extends VolumeGridResult {}

export interface VolumeEvalOptions extends EvaluationOptions {
  /** When true, aborts between Y slices (worker cancel). */
  shouldCancel?: () => boolean;
}

/* ── Main export ──────────────────────────────────────────────────── */

/**
 * Evaluate a density node graph over a 3D volume.
 * Layout: densities[y * n * n + z * n + x] (Y-major)
 */
export function evaluateDensityVolume(
  nodes: Node[],
  edges: Edge[],
  resolution: number,
  rangeMin: number,
  rangeMax: number,
  yMin: number,
  yMax: number,
  ySlices: number,
  rootNodeId?: string,
  options?: VolumeEvalOptions,
): VolumeResult {
  const ctx = createEvaluationContext(nodes, edges, rootNodeId, options);
  if (!ctx) {
    const n = Math.max(1, resolution);
    const ys = Math.max(1, ySlices);
    return {
      densities: new Float32Array(n * n * ys),
      resolution: n,
      ySlices: ys,
      minValue: 0,
      maxValue: 0,
    };
  }

  return evaluateDensityGrid3D(
    ctx,
    { resolution, rangeMin, rangeMax, yMin, yMax, ySlices },
    options?.shouldCancel,
  );
}

/**
 * Evaluate multiple volume grids reusing one evaluation context (progressive passes).
 */
export function evaluateDensityVolumeSteps(
  nodes: Node[],
  edges: Edge[],
  rootNodeId: string | undefined,
  options: EvaluationOptions | undefined,
  bounds: Pick<VolumeGridParams, "rangeMin" | "rangeMax" | "yMin" | "yMax">,
  steps: Array<Pick<VolumeGridParams, "resolution" | "ySlices">>,
  shouldCancel?: () => boolean,
): VolumeResult[] {
  const ctx = createEvaluationContext(nodes, edges, rootNodeId, options);
  if (!ctx) {
    return steps.map(({ resolution, ySlices }) => ({
      densities: new Float32Array(Math.max(1, resolution) ** 2 * Math.max(1, ySlices)),
      resolution: Math.max(1, resolution),
      ySlices: Math.max(1, ySlices),
      minValue: 0,
      maxValue: 0,
    }));
  }

  return steps.map(({ resolution, ySlices }) => evaluateDensityGrid3D(
    ctx,
    { ...bounds, resolution, ySlices },
    shouldCancel,
  ));
}
