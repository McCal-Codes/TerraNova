import type { Node, Edge } from "@xyflow/react";
import { PropPlacementCanvasView } from "./PropPlacementCanvasView";

interface PropPlacementGridProps {
  nodes: Node[];
  edges: Edge[];
  /** Optional: evaluate from a specific node instead of auto-detecting the root */
  rootNodeId?: string;
}

export function PropPlacementGrid({ nodes, edges, rootNodeId }: PropPlacementGridProps) {
  return (
    <PropPlacementCanvasView
      nodes={nodes}
      edges={edges}
      rootNodeId={rootNodeId}
      compact
    />
  );
}
