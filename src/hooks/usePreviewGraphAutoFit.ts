import { useEffect, useRef } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { useEditorStore } from "@/stores/editorStore";
import { useEvaluationFingerprint } from "@/hooks/useEvaluationFingerprint";
import { analyzeGraphDefaults, computeGraphHash } from "@/utils/previewAutoFit";

/**
 * Applies graph-aware Y level (rivers, terrain surface) for 2D/3D density preview.
 * Voxel Y bounds are handled separately in useVoxelEvaluation.
 */
export function usePreviewGraphAutoFit() {
  const evalFingerprint = useEvaluationFingerprint();
  const mode = usePreviewStore((s) => s.mode);
  const autoFitYEnabled = usePreviewStore((s) => s.autoFitYEnabled);
  const terrainRefUseBaseY = usePreviewStore((s) => s.terrainRefUseBaseY);
  const graphHashRef = useRef("");

  useEffect(() => {
    if (!autoFitYEnabled || mode === "voxel" || mode === "world") return;

    const { nodes, edges, contentFields, materialConfig } = useEditorStore.getState();
    const store = usePreviewStore.getState();
    if (store._userManualYAdjust) return;

    const graphKey = `${computeGraphHash(nodes, edges)}|${terrainRefUseBaseY ? "baseY" : "profileZero"}`;
    if (graphKey === graphHashRef.current) return;

    const defaults = analyzeGraphDefaults(nodes, edges, contentFields, {
      useBaseY: terrainRefUseBaseY,
      materialConfig,
    });

    const shouldApplyYLevel = defaults.suggestedYLevel != null && (
      defaults.hydrographyDetected
      || defaults.confidence === "high"
    );

    const suggestedY = defaults.suggestedYLevel;
    if (shouldApplyYLevel && suggestedY != null && suggestedY !== store.yLevel) {
      store.setYLevel(suggestedY);
    }

    graphHashRef.current = graphKey;
  }, [evalFingerprint, mode, autoFitYEnabled, terrainRefUseBaseY]);
}
