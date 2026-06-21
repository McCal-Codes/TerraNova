import { useEffect } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { useEditorStore } from "@/stores/editorStore";
import { useEvaluationFingerprint } from "@/hooks/useEvaluationFingerprint";
import { useResolvePreviewRoot } from "@/hooks/useResolvePreviewRoot";
import { computeEvaluationFingerprint } from "@/utils/previewAutoFit";
import { previewTargetNeedsVoxel } from "@/utils/densityPreviewRouting";
import { useToastStore } from "@/stores/toastStore";
import { usePropEditingContext } from "@/hooks/usePropEditingContext";
import { useMaterialEditingContext } from "@/hooks/useMaterialEditingContext";

/**
 * Once per graph fingerprint, auto-switch from 2D to Voxel when the preview target
 * subtree includes 3D noise or carve masks. Respects _userManualPreviewMode.
 */
export function useDensityPreviewModeRouting() {
  const evalFingerprint = useEvaluationFingerprint();
  const rootResolution = useResolvePreviewRoot();
  const { isPropContext } = usePropEditingContext();
  const { isMaterialContext } = useMaterialEditingContext();

  useEffect(() => {
    const store = usePreviewStore.getState();
    if (store.viewMode === "compare" || isPropContext || isMaterialContext) return;
    if (store._userManualPreviewMode) return;
    if (store.mode !== "2d") return;

    const previewRootId = rootResolution.nodeId;
    if (!previewRootId) return;

    const { nodes, edges, contentFields } = useEditorStore.getState();
    const graphKey = `${computeEvaluationFingerprint({ nodes, edges, contentFields })}|root:${previewRootId}`;
    if (graphKey === store._autoVoxelGraphHash) return;

    const { needsVoxel, reason } = previewTargetNeedsVoxel(nodes, edges, previewRootId);
    if (!needsVoxel || !reason) return;

    store._setAutoVoxelGraphHash(graphKey);
    store.setMode("voxel", { automated: true });
    useToastStore.getState().addToast(reason, "info");
  }, [evalFingerprint, rootResolution.nodeId, isPropContext, isMaterialContext]);
}
