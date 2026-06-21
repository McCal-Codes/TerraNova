import { useMemo } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewStore } from "@/stores/previewStore";
import { resolvePreviewRoot, type PreviewRootResolution } from "@/utils/previewRootResolver";

export function useResolvePreviewRoot(): PreviewRootResolution {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const outputNodeId = useEditorStore((s) => s.outputNodeId);
  const selectedPreviewNodeId = usePreviewStore((s) => s.selectedPreviewNodeId);

  return useMemo(
    () => resolvePreviewRoot({ nodes, edges, selectedPreviewNodeId, outputNodeId }),
    [nodes, edges, selectedPreviewNodeId, outputNodeId],
  );
}
