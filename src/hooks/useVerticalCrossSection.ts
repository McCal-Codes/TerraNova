import { useEffect, useRef } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { useEditorStore } from "@/stores/editorStore";
import { useEvaluationFingerprint } from "@/hooks/useEvaluationFingerprint";
import { evaluateVolumeInWorker } from "@/utils/volumeWorkerClient";
import { enrichPreviewContentFields } from "@/utils/densityEvaluator";
import { useConfigStore } from "@/stores/configStore";
import { resolvePreviewRootNodeId } from "@/utils/previewRootResolver";

/**
 * Lazily evaluates a low-res volume for vertical cross-section profiles in 2D mode.
 * Reuses cached voxelDensities when dimensions match; otherwise runs a debounced worker pass.
 */
export function useVerticalCrossSection() {
  const evalFingerprint = useEvaluationFingerprint();
  const mode = usePreviewStore((s) => s.mode);
  const viewMode = usePreviewStore((s) => s.viewMode);
  const autoRefresh = usePreviewStore((s) => s.autoRefresh);
  const showCrossSection = usePreviewStore((s) => s.showCrossSection);
  const crossSectionLine = usePreviewStore((s) => s.crossSectionLine);
  const profileMode = usePreviewStore((s) => s.crossSectionProfileMode);
  const voxelDensities = usePreviewStore((s) => s.voxelDensities);
  const voxelYMin = usePreviewStore((s) => s.voxelYMin);
  const voxelYMax = usePreviewStore((s) => s.voxelYMax);
  const voxelResolution = usePreviewStore((s) => s.voxelResolution);
  const voxelYSlices = usePreviewStore((s) => s.voxelYSlices);
  const rangeMin = usePreviewStore((s) => s.rangeMin);
  const rangeMax = usePreviewStore((s) => s.rangeMax);
  const debounceMs = useConfigStore((s) => s.debounceMs);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evalIdRef = useRef(0);

  useEffect(() => {
    const active = mode === "2d"
      && viewMode !== "graph"
      && autoRefresh
      && showCrossSection
      && crossSectionLine
      && profileMode === "section";

    if (!active) {
      usePreviewStore.getState().setVerticalSectionDensities(null, null);
      usePreviewStore.getState().setVerticalSectionLoading(false);
      return;
    }

    if (voxelDensities) {
      const expectedLen = voxelResolution * voxelResolution * Math.max(1, voxelYSlices);
      if (voxelDensities.length >= expectedLen) {
        usePreviewStore.getState().setVerticalSectionDensities(voxelDensities, {
          resolution: voxelResolution,
          ySlices: voxelYSlices,
          yMin: voxelYMin,
          yMax: voxelYMax,
          rangeMin,
          rangeMax,
        });
        usePreviewStore.getState().setVerticalSectionLoading(false);
        return;
      }
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    const evalId = ++evalIdRef.current;

    timerRef.current = setTimeout(async () => {
      const {
        nodes,
        edges,
        contentFields,
        outputNodeId,
      } = useEditorStore.getState();
      const store = usePreviewStore.getState();

      if (nodes.length === 0) {
        store.setVerticalSectionDensities(null, null);
        store.setVerticalSectionLoading(false);
        return;
      }

      store.setVerticalSectionLoading(true);

      try {
        const res = 32;
        const ys = 48;
        const result = await evaluateVolumeInWorker({
          nodes,
          edges,
          resolution: res,
          rangeMin: store.rangeMin,
          rangeMax: store.rangeMax,
          yMin: store.voxelYMin,
          yMax: store.voxelYMax,
          ySlices: ys,
          rootNodeId: resolvePreviewRootNodeId({
            nodes,
            edges,
            selectedPreviewNodeId: store.selectedPreviewNodeId,
            outputNodeId: outputNodeId ?? undefined,
          }),
          options: {
            contentFields: enrichPreviewContentFields(
              contentFields,
              store.rangeMin,
              store.rangeMax,
              store.yLevel,
            ),
          },
        });

        if (evalId !== evalIdRef.current) return;

        store.setVerticalSectionDensities(result.densities, {
          resolution: result.resolution,
          ySlices: result.ySlices,
          yMin: store.voxelYMin,
          yMax: store.voxelYMax,
          rangeMin: store.rangeMin,
          rangeMax: store.rangeMax,
        });
      } catch {
        if (evalId === evalIdRef.current) {
          store.setVerticalSectionDensities(null, null);
        }
      } finally {
        if (evalId === evalIdRef.current) {
          store.setVerticalSectionLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    evalFingerprint,
    mode,
    viewMode,
    autoRefresh,
    showCrossSection,
    crossSectionLine,
    profileMode,
    voxelDensities,
    voxelYMin,
    voxelYMax,
    voxelResolution,
    voxelYSlices,
    rangeMin,
    rangeMax,
    debounceMs,
  ]);
}
