import type { Node, Edge } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";

export type VoxelMaterialGraphSource = "canvas" | "material-section" | "none";

export interface VoxelMaterialGraph {
  nodes: Node[];
  edges: Edge[];
  source: VoxelMaterialGraphSource;
}

export interface VoxelMaterialGraphInput {
  nodes: Node[];
  edges: Edge[];
  biomeSections?: Record<string, { nodes: Node[]; edges: Edge[] }> | null;
}

function materialNodeType(node: Node): string {
  return node.type ?? getNodeType(node);
}

function graphHasMaterialNodes(nodes: Node[]): boolean {
  return nodes.some((n) => {
    const t = materialNodeType(n);
    return t.startsWith("Material:") || t.startsWith("Layer:");
  });
}

/** Prefer live material nodes; fall back to biome MaterialProvider section while editing terrain. */
export function resolveVoxelMaterialGraph(input: VoxelMaterialGraphInput): VoxelMaterialGraph {
  if (graphHasMaterialNodes(input.nodes)) {
    return { nodes: input.nodes, edges: input.edges, source: "canvas" };
  }

  const materialSection = input.biomeSections?.MaterialProvider;
  if (materialSection && materialSection.nodes.length > 0) {
    return {
      nodes: materialSection.nodes,
      edges: materialSection.edges,
      source: "material-section",
    };
  }

  return { nodes: input.nodes, edges: input.edges, source: "none" };
}

export function voxelMaterialGraphHasEvaluator(graph: VoxelMaterialGraph): boolean {
  return graph.source !== "none" && graphHasMaterialNodes(graph.nodes);
}
