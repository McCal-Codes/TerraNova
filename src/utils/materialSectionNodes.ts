import type { Node } from "@xyflow/react";
import { nodeTypes } from "@/nodes";
import { isAnnotationNode } from "@/utils/annotationUtils";
import { sanitizeGraphNodesAndEdges } from "@/utils/sanitizeGraphNodes";

/**
 * MaterialProvider tab nodes imported before the jsonToGraph category fix may still
 * use bare density React Flow types (e.g. `Imported` instead of `Material:Imported`).
 * Re-map them so the correct components, fields, and serialization run.
 */
export function normalizeMaterialSectionNodeTypes(nodes: Node[]): Node[] {
  const needsSanitize = nodes.some((n) => !n?.id);
  const workingNodes = needsSanitize ? sanitizeGraphNodesAndEdges(nodes, []).nodes : nodes;
  let changed = needsSanitize;
  const next = workingNodes.map((node) => {
    if (!node) return node;
    if (isAnnotationNode(node) || node.type === "group") return node;
    const data = node.data as Record<string, unknown> | undefined;
    if (!data || typeof data.type !== "string") return node;

    const bareType = data.type;
    if (bareType.includes(":")) return node;

    const materialKey = `Material:${bareType}`;
    if (!(materialKey in nodeTypes)) return node;
    if (node.type === materialKey) return node;

    // Bare RF type matching bare data.type → density component was used by mistake.
    if (node.type === bareType || !node.type) {
      changed = true;
      return { ...node, type: materialKey };
    }

    return node;
  });

  return changed ? next : workingNodes;
}
