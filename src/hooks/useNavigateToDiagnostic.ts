import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useEditorStore } from "@/stores/editorStore";
import type { GraphDiagnostic } from "@/utils/graphDiagnostics";

/** Focus canvas or biome section for a validation diagnostic (shared by Issues panel + strip). */
export function useNavigateToDiagnostic() {
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);
  const setEditingContext = useEditorStore((s) => s.setEditingContext);
  const switchBiomeSection = useEditorStore((s) => s.switchBiomeSection);
  const reactFlow = useReactFlow();

  return useCallback((diagnostic: GraphDiagnostic) => {
    if (diagnostic.nodeId) {
      setSelectedNodeId(diagnostic.nodeId);
      reactFlow.fitView({
        nodes: [{ id: diagnostic.nodeId }],
        padding: 0.3,
        duration: 300,
      });
      return;
    }

    if (!diagnostic.biomeSection) return;

    setEditingContext("Biome");
    switchBiomeSection(diagnostic.biomeSection);

    const sectionOutputId =
      useEditorStore.getState().biomeSections?.[diagnostic.biomeSection]?.outputNodeId ?? null;
    if (sectionOutputId) {
      setSelectedNodeId(sectionOutputId);
      reactFlow.fitView({
        nodes: [{ id: sectionOutputId }],
        padding: 0.3,
        duration: 300,
      });
    } else {
      setSelectedNodeId(null);
    }
  }, [reactFlow, setEditingContext, setSelectedNodeId, switchBiomeSection]);
}
