import { useMemo } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewStore } from "@/stores/previewStore";
import { computeEvaluationFingerprint } from "@/utils/previewAutoFit";
import { resolvePreviewRootForEvaluation } from "@/utils/previewRootResolver";

/**
 * Stable key for preview evaluation effects — ignores canvas-only layout changes
 * (frame/comment moves, graph node positions) that do not affect density output.
 */
export function useEvaluationFingerprint(): string {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const contentFields = useEditorStore((s) => s.contentFields);
  const outputNodeId = useEditorStore((s) => s.outputNodeId);
  const materialConfig = useEditorStore((s) => s.materialConfig);
  const selectedPreviewNodeId = usePreviewStore((s) => s.selectedPreviewNodeId);

  const rootResolution = useMemo(
    () => resolvePreviewRootForEvaluation({ nodes, edges, selectedPreviewNodeId, outputNodeId }),
    [nodes, edges, selectedPreviewNodeId, outputNodeId],
  );

  return useMemo(
    () =>
      computeEvaluationFingerprint({
        nodes,
        edges,
        contentFields,
        rootNodeId: rootResolution.nodeId,
        rootSource: rootResolution.source,
        materialConfig,
      }),
    [nodes, edges, contentFields, materialConfig, rootResolution.nodeId, rootResolution.source],
  );
}
