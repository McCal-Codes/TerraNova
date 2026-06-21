import type { Node, Edge } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";
import type { DensityExportGraph, DensityExportMap } from "@/utils/densityExportRegistry";
import { isCellNoiseType } from "./shapePreviewProfile";

function nodeFields(node: Node): Record<string, unknown> {
  return ((node.data as Record<string, unknown>)?.fields as Record<string, unknown>) ?? {};
}

function exportGraphOutputId(graph: DensityExportGraph): string | null {
  const exported = graph.nodes.find((n) => getNodeType(n) === "Exported");
  if (exported) {
    const edge = graph.edges.find((e) => e.target === exported.id);
    if (edge?.source) return edge.source;
  }
  return graph.nodes.length > 0 ? graph.nodes[graph.nodes.length - 1]!.id : null;
}

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
  externalDensityExports?: DensityExportMap,
): Node[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const allEdges = [...edges];
  if (externalDensityExports) {
    for (const graph of Object.values(externalDensityExports)) {
      for (const n of graph.nodes) nodeById.set(n.id, n);
      allEdges.push(...graph.edges);
    }
  }

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

    if (
      (type === "Imported" || type === "ImportedValue") &&
      externalDensityExports
    ) {
      const name = String(nodeFields(node).Name ?? nodeFields(node).ExportAs ?? "").trim();
      const sub = name ? externalDensityExports[name] : undefined;
      if (sub) {
        const subStart = exportGraphOutputId(sub);
        if (subStart) {
          const nested = findUpstreamCellNoiseNodes(
            [...nodes, ...sub.nodes],
            [...edges, ...sub.edges],
            subStart,
            maxNodes - found.length,
            externalDensityExports,
          );
          for (const n of nested) {
            if (found.length >= maxNodes) break;
            if (!found.some((f) => f.id === n.id)) found.push(n);
          }
        }
      }
      continue;
    }

    for (const e of allEdges) {
      if (e.target !== id) continue;
      queue.push(e.source);
    }
  }

  return found;
}
