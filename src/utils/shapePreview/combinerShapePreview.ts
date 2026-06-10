import type { Node, Edge } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";
import { isCellNoiseType } from "./shapePreviewProfile";

/** Density combiners that can show merged upstream PCN / CellNoise cell walls in 2D. */
export const SHAPE_PREVIEW_COMBINER_TYPES = new Set([
  "Max",
  "Min",
  "MaxFunction",
  "MinFunction",
  "Sum",
  "Multiplier",
  "Mix",
  "Blend",
  "AverageFunction",
  "Normalizer",
]);

/**
 * Walk density inputs upstream from a combiner and collect CellNoise / PCN nodes.
 */
export function findUpstreamCellNoiseNodes(
  nodes: Node[],
  edges: Edge[],
  startId: string,
  maxNodes = 6,
): Node[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const found: Node[] = [];
  const seen = new Set<string>();
  const queue = [startId];

  while (queue.length > 0 && found.length < maxNodes) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);

    const node = nodeById.get(id);
    if (!node) continue;

    const type = getNodeType(node);
    if (isCellNoiseType(type)) {
      found.push(node);
      continue;
    }

    for (const e of edges) {
      if (e.target !== id) continue;
      queue.push(e.source);
    }
  }

  return found;
}
