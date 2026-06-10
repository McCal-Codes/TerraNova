import type { Edge, Node } from "@xyflow/react";

/** Drop holes/invalid React Flow nodes and edges that reference missing node ids. */
export function sanitizeGraphNodesAndEdges(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const cleanNodes = nodes.filter((n): n is Node => Boolean(n?.id));
  const ids = new Set(cleanNodes.map((n) => n.id));
  const cleanEdges = edges.filter(
    (e) => Boolean(e?.source && e?.target && ids.has(e.source) && ids.has(e.target)),
  );
  return { nodes: cleanNodes, edges: cleanEdges };
}

/** Sanitize nodes/edges for each entry in a biome section map. */
export function sanitizeBiomeSectionNodeMap(
  sectionNodes: Record<string, Node[]>,
): Record<string, Node[]> {
  const result: Record<string, Node[]> = {};
  for (const [key, nodes] of Object.entries(sectionNodes)) {
    result[key] = sanitizeGraphNodesAndEdges(nodes, []).nodes;
  }
  return result;
}
