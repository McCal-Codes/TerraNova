import { useMemo, useCallback } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { useEditorStore } from "@/stores/editorStore";
import { getNodeType } from "@/utils/density/evalTypes";
import { supportsShapePreviewCard } from "@/utils/shapePreview/shapePreviewProfile";

export function usePreviewTarget() {
  const selectedPreviewNodeId = usePreviewStore((s) => s.selectedPreviewNodeId);
  const outputNodeId = useEditorStore((s) => s.outputNodeId);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const nodes = useEditorStore((s) => s.nodes);
  const setSelectedPreviewNodeId = usePreviewStore((s) => s.setSelectedPreviewNodeId);
  const setShowShapePreview = usePreviewStore((s) => s.setShowShapePreview);

  const previewTargetId = selectedPreviewNodeId ?? outputNodeId;

  const previewTargetNode = useMemo(
    () => (previewTargetId ? nodes.find((n) => n.id === previewTargetId) : null),
    [previewTargetId, nodes],
  );

  const previewTargetType = previewTargetNode ? getNodeType(previewTargetNode) : null;

  const previewTargetLabel = useMemo(() => {
    if (!previewTargetId) return "Auto (terminal / output)";
    return previewTargetType ?? previewTargetId;
  }, [previewTargetId, previewTargetType]);

  const graphSelectionDiffers =
    !!selectedNodeId && selectedNodeId !== selectedPreviewNodeId;

  const syncFromGraphSelection = useCallback(() => {
    if (!selectedNodeId) return;
    setSelectedPreviewNodeId(selectedNodeId);
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (node && supportsShapePreviewCard(getNodeType(node))) {
      setShowShapePreview(true);
    }
  }, [selectedNodeId, nodes, setSelectedPreviewNodeId, setShowShapePreview]);

  return {
    previewTargetId,
    previewTargetNode,
    previewTargetType,
    previewTargetLabel,
    graphSelectionDiffers,
    syncFromGraphSelection,
  };
}
