import { useMemo } from "react";
import { useEdges } from "@xyflow/react";
import type { HandleDef } from "@/nodes/shared/handles";
import { resolveCompoundHandles } from "@/nodes/shared/resolveCompoundHandles";

/**
 * For compound-eligible nodes, dynamically resolves handles by inspecting
 * current edges. An empty slot is always appended after the last connected
 * index so users can drag-connect additional inputs.
 *
 * Non-compound handles (outputs, differently-categorized inputs like Factor)
 * are preserved in their original positions.
 */
export function useCompoundHandles(nodeId: string, nodeType: string): HandleDef[] {
  const allEdges = useEdges();

  return useMemo(
    () => resolveCompoundHandles(nodeId, nodeType, allEdges),
    [nodeId, nodeType, allEdges],
  );
}
