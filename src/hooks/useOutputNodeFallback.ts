import { useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { findDensityRoot } from "@/utils/density/evalTypes";

/**
 * When a density graph has no Root node and no designated output, sync outputNodeId
 * from the terminal density node so preview/export resolve consistently.
 */
export function useOutputNodeFallback() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const outputNodeId = useEditorStore((s) => s.outputNodeId);
  const editingContext = useEditorStore((s) => s.editingContext);
  const setOutputNode = useEditorStore((s) => s.setOutputNode);

  useEffect(() => {
    if (editingContext !== "Density" && editingContext !== "Biome") return;
    if (outputNodeId) return;
    if (nodes.some((node) => node.type === "Root")) return;

    const terminal = findDensityRoot(nodes, edges);
    if (terminal) {
      setOutputNode(terminal.id);
    }
  }, [nodes, edges, outputNodeId, editingContext, setOutputNode]);
}
