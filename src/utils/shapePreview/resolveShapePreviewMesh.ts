import type { Edge, Node } from "@xyflow/react";
import { getNodeType } from "../density/evalTypes";

const MESH_TYPES = new Set(["Mesh2D", "Mesh3D"]);

function bareMeshType(type: string): string {
  if (type.startsWith("Position:")) return type.slice("Position:".length);
  return type;
}

function isMeshNodeType(type: string): boolean {
  return MESH_TYPES.has(bareMeshType(type));
}

const POSITION_INPUT_HANDLES = new Set(["Positions", "PositionProvider"]);

/**
 * Walk upstream along position-provider inputs until a Mesh2D/Mesh3D node is found.
 */
function findMeshUpstream(
  nodes: Node[],
  edges: Edge[],
  startId: string,
  maxDepth = 12,
): string | null {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  let frontier = [startId];

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      if (visited.has(id)) continue;
      visited.add(id);

      const node = nodeById.get(id);
      if (!node) continue;
      if (isMeshNodeType(getNodeType(node))) return id;

      for (const e of edges) {
        if (e.target !== id) continue;
        const handle = e.targetHandle ?? "";
        if (!POSITION_INPUT_HANDLES.has(handle)) continue;
        next.push(e.source);
      }
    }
    frontier = next;
  }

  return null;
}

/**
 * Node id to evaluate for mesh overlay: direct mesh target, or PCN Positions input chain.
 */
export function resolveShapePreviewMeshNodeId(
  nodes: Node[],
  edges: Edge[],
  previewTargetId: string | null,
): string | null {
  if (!previewTargetId) return null;

  const target = nodes.find((n) => n.id === previewTargetId);
  if (!target) return null;

  const type = getNodeType(target);
  if (isMeshNodeType(type)) return previewTargetId;

  if (type === "PositionsCellNoise" || type === "Positions3D") {
    const edge = edges.find(
      (e) => e.target === previewTargetId && POSITION_INPUT_HANDLES.has(e.targetHandle ?? ""),
    );
    if (!edge) return findMeshUpstream(nodes, edges, previewTargetId);
    return findMeshUpstream(nodes, edges, edge.source);
  }

  return null;
}
