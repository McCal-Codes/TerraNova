import { useEffect, useMemo, useCallback } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { useEditorStore } from "@/stores/editorStore";
import { DENSITY_TYPES, getNodeType } from "@/utils/density/evalTypes";
import { supportsShapePreviewCard } from "@/utils/shapePreview/shapePreviewProfile";
import { useResolvePreviewRoot } from "@/hooks/useResolvePreviewRoot";

export function usePreviewTarget() {
  const selectedPreviewNodeId = usePreviewStore((s) => s.selectedPreviewNodeId);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const nodes = useEditorStore((s) => s.nodes);
  const setSelectedPreviewNodeId = usePreviewStore((s) => s.setSelectedPreviewNodeId);
  const setShowShapePreview = usePreviewStore((s) => s.setShowShapePreview);
  const rootResolution = useResolvePreviewRoot();

  useEffect(() => {
    if (!selectedPreviewNodeId) return;
    const node = nodes.find((n) => n.id === selectedPreviewNodeId);
    if (!node || !DENSITY_TYPES.has(getNodeType(node))) {
      setSelectedPreviewNodeId(null);
    }
  }, [nodes, selectedPreviewNodeId, setSelectedPreviewNodeId]);

  const previewTargetId = rootResolution.nodeId;

  const previewTargetNode = useMemo(
    () => (previewTargetId ? nodes.find((n) => n.id === previewTargetId) : null),
    [previewTargetId, nodes],
  );

  const previewTargetType = previewTargetNode ? getNodeType(previewTargetNode) : null;

  const previewTargetLabel = useMemo(() => {
    if (selectedPreviewNodeId) {
      return previewTargetType ?? selectedPreviewNodeId;
    }
    if (rootResolution.source === "output-node") return "Auto (designated output)";
    if (rootResolution.source === "inferred-root") return "Auto (terminal node)";
    return "Auto";
  }, [selectedPreviewNodeId, previewTargetType, rootResolution.source]);

  const graphSelectionDiffers =
    !!selectedNodeId && selectedNodeId !== selectedPreviewNodeId;

  const syncFromGraphSelection = useCallback(() => {
    if (!selectedNodeId) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node || !DENSITY_TYPES.has(getNodeType(node))) return;
    setSelectedPreviewNodeId(selectedNodeId);
    if (supportsShapePreviewCard(getNodeType(node))) {
      setShowShapePreview(true);
    }
  }, [selectedNodeId, nodes, setSelectedPreviewNodeId, setShowShapePreview]);

  return {
    previewTargetId,
    previewTargetNode,
    previewTargetType,
    previewTargetLabel,
    rootResolution,
    graphSelectionDiffers,
    syncFromGraphSelection,
  };
}
