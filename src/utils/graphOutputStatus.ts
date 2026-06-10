import type { Edge, Node } from "@xyflow/react";
import { findDensityRoot } from "@/utils/density/evalTypes";

export interface GraphOutputStatus {
  label: string;
  warning: boolean;
}

function getNodeTypeLabel(data: unknown): string {
  const record = data as Record<string, unknown> | undefined;
  return typeof record?.type === "string" && record.type.length > 0 ? record.type : "Node";
}

/** Resolve HUD label for graph output — supports Root node, biome outputNodeId, and terminal fallback. */
export function getGraphOutputStatus(
  nodes: Node[],
  edges: Edge[],
  outputNodeId: string | null,
  getTypeDisplayName: (type: string) => string,
): GraphOutputStatus | null {
  const rootNode = nodes.find((node) => node.type === "Root");
  if (rootNode) {
    const rootEdge = edges.find((edge) => edge.target === rootNode.id);
    if (!rootEdge) return { label: "Root unwired", warning: true };
    const sourceNode = nodes.find((node) => node.id === rootEdge.source);
    return sourceNode
      ? { label: `Root: ${getTypeDisplayName(getNodeTypeLabel(sourceNode.data))}`, warning: false }
      : { label: "Root wired", warning: false };
  }

  if (outputNodeId) {
    const outputNode = nodes.find((node) => node.id === outputNodeId);
    if (outputNode) {
      return {
        label: `Output: ${getTypeDisplayName(getNodeTypeLabel(outputNode.data))}`,
        warning: false,
      };
    }
  }

  const taggedOutput = nodes.find(
    (node) => (node.data as Record<string, unknown>)._outputNode === true,
  );
  if (taggedOutput) {
    return {
      label: `Output: ${getTypeDisplayName(getNodeTypeLabel(taggedOutput.data))}`,
      warning: false,
    };
  }

  const terminal = findDensityRoot(nodes, edges);
  if (terminal) {
    return {
      label: `Preview: ${getTypeDisplayName(getNodeTypeLabel(terminal.data))}`,
      warning: false,
    };
  }

  return { label: "Root missing", warning: true };
}
