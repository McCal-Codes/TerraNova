import type { Node, Edge } from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { useEditorStore } from "@/stores/editorStore";
import { useEvaluationFingerprint } from "@/hooks/useEvaluationFingerprint";
import {
  evaluateVolumeInWorker,
  evaluateVolumeProgressive,
  cancelVolumeEvaluation,
} from "@/utils/volumeWorkerClient";
import { enrichPreviewContentFields } from "@/utils/densityEvaluator";
import { buildDensityEvalOptions } from "@/utils/buildDensityEvalOptions";
import { useProjectStore } from "@/stores/projectStore";
import { useConfigStore } from "@/stores/configStore";
import {
  computeGraphHash,
  analyzeGraphDefaults,
} from "@/utils/previewAutoFit";
import { analyzeGraphPreviewFeatures } from "@/utils/graphPreviewFeatures";
import { computeTerrainAutoFitYBounds } from "@/utils/terrainPreviewLevel";
import { computeVolumeSessionKey, computeVoxelEvalKey } from "@/utils/volumeSessionKey";
import { buildProgressiveVolumeSteps } from "@/utils/volumeEvaluationCore";
import { finishVoxelFromVolume } from "@/utils/finishVoxelFromVolume";
import { useToastStore } from "@/stores/toastStore";
import { useDevMetricsStore } from "@/stores/devMetricsStore";

import { deferMainThreadWork } from "@/utils/deferMainThreadWork";

function isVoxelViewMode(mode: string, show3DVolumeView: boolean): boolean {
  return mode === "voxel" || (mode === "3d" && show3DVolumeView);
}

/** Sync terrain Y from height profile — no density scan, no eval restart. */
function applyTerrainYBeforeEval(live: ReturnType<typeof readVoxelEvalParams>): boolean {
  const store = usePreviewStore.getState();
  if (!store.autoFitYEnabled || store._userManualYAdjust) return false;

  const autoFitKey = terrainAutoFitGraphKey(live.nodes, live.edges, live.terrainRefUseBaseY);
  if (autoFitKey === store._autoFitGraphHash) return false;

  store._setAutoFitGraphHash(autoFitKey);

  const features = analyzeGraphPreviewFeatures(
    live.nodes,
    live.edges,
    live.contentFields,
    live.materialConfig,
  );

  const terrainAutoFit = computeTerrainAutoFitYBounds(
    live.nodes,
    live.edges,
    live.contentFields,
    {
      rangeMin: live.rangeMin,
      rangeMax: live.rangeMax,
      rootNodeId: live.selectedPreviewNodeId ?? live.outputNodeId ?? undefined,
      useBaseY: live.terrainRefUseBaseY,
      undergroundCarving: features.undergroundCarving,
      belowPad: features.belowPad,
    },
  );
  if (!terrainAutoFit) return false;

  const yChanged = terrainAutoFit.worldYMin !== live.voxelYMin
    || terrainAutoFit.worldYMax !== live.voxelYMax
    || terrainAutoFit.yLevel !== live.yLevel;
  if (!yChanged) return false;

  store.setVoxelYMin(terrainAutoFit.worldYMin);
  store.setVoxelYMax(terrainAutoFit.worldYMax);
  store.setYLevel(terrainAutoFit.yLevel);
  return true;
}

function readVoxelEvalParams(mode: string, show3DVolumeView: boolean) {
  const preview = usePreviewStore.getState();
  const editor = useEditorStore.getState();
  return {
    nodes: editor.nodes,
    edges: editor.edges,
    contentFields: editor.contentFields,
    outputNodeId: editor.outputNodeId,
    materialConfig: editor.materialConfig,
    rangeMin: preview.rangeMin,
    rangeMax: preview.rangeMax,
    yLevel: preview.yLevel,
    voxelYMin: preview.voxelYMin,
    voxelYMax: preview.voxelYMax,
    voxelYSlices: preview.voxelYSlices,
    voxelResolution: preview.voxelResolution,
    selectedPreviewNodeId: preview.selectedPreviewNodeId,
    targetRes: mode === "3d" && show3DVolumeView ? Math.min(preview.voxelResolution, 64) : preview.voxelResolution,
    show3DVolumeView,
    terrainRefUseBaseY: preview.terrainRefUseBaseY,
  };
}

async function buildVolumeEvalOptions(
  nodes: Node[],
  edges: Edge[],
  contentFields: Record<string, number>,
  rangeMin: number,
  rangeMax: number,
  yLevel: number,
  projectPath: string | null,
) {
  const base = await buildDensityEvalOptions({
    nodes,
    edges,
    contentFields,
    projectPath,
  });
  return {
    ...base,
    contentFields: enrichPreviewContentFields(
      base.contentFields ?? contentFields,
      rangeMin,
      rangeMax,
      yLevel,
    ),
  };
}

function terrainAutoFitGraphKey(nodes: Node[], edges: Edge[], useBaseY: boolean): string {
  return `${computeGraphHash(nodes, edges)}|${useBaseY ? "baseY" : "profileZero"}`;
}

/**
 * Voxel evaluation hook — warms voxel mesh in the background while in 2D/3D,
 * and reuses cached mesh instantly when switching to voxel view.
 */
export function useVoxelEvaluation() {
  const evalFingerprint = useEvaluationFingerprint();
  const mode = usePreviewStore((s) => s.mode);
  const show3DVolumeView = usePreviewStore((s) => s.show3DVolumeView);
  const rangeMin = usePreviewStore((s) => s.rangeMin);
  const rangeMax = usePreviewStore((s) => s.rangeMax);
  const yLevel = usePreviewStore((s) => s.yLevel);
  const voxelYMin = usePreviewStore((s) => s.voxelYMin);
  const voxelYMax = usePreviewStore((s) => s.voxelYMax);
  const voxelYSlices = usePreviewStore((s) => s.voxelYSlices);
  const voxelResolution = usePreviewStore((s) => s.voxelResolution);
  const viewMode = usePreviewStore((s) => s.viewMode);
  const autoRefresh = usePreviewStore((s) => s.autoRefresh);
  const showMaterialColors = usePreviewStore((s) => s.showMaterialColors);
  const autoFitYEnabled = usePreviewStore((s) => s.autoFitYEnabled);
  const terrainRefUseBaseY = usePreviewStore((s) => s.terrainRefUseBaseY);
  const setVoxelDensities = usePreviewStore((s) => s.setVoxelDensities);
  const setVoxelLoading = usePreviewStore((s) => s.setVoxelLoading);
  const setVoxelEvalProgressRes = usePreviewStore((s) => s.setVoxelEvalProgressRes);
  const setVoxelError = usePreviewStore((s) => s.setVoxelError);
  const debounceMs = useConfigStore((s) => s.debounceMs);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evalIdRef = useRef(0);
  const unmountedRef = useRef(false);
  const graphDefaultsHashRef = useRef("");
  const latestVoxelEvalKeyRef = useRef("");

  const targetRes = mode === "3d" && show3DVolumeView
    ? Math.min(voxelResolution, 64)
    : voxelResolution;

  const voxelEvalKey = useMemo(
    () => computeVoxelEvalKey({
      evalFingerprint,
      rangeMin,
      rangeMax,
      yLevel,
      voxelYMin,
      voxelYMax,
      voxelYSlices,
      targetRes,
      showMaterialColors,
    }),
    [
      evalFingerprint, rangeMin, rangeMax, yLevel,
      voxelYMin, voxelYMax, voxelYSlices, targetRes, showMaterialColors,
    ],
  );

  latestVoxelEvalKeyRef.current = voxelEvalKey;

  useEffect(() => {
    const voxelLike = isVoxelViewMode(mode, show3DVolumeView);
    if (!voxelLike || !autoFitYEnabled) return;

    const { nodes, edges, contentFields, materialConfig } = useEditorStore.getState();
    const store = usePreviewStore.getState();
    const defaultsKey = terrainAutoFitGraphKey(nodes, edges, store.terrainRefUseBaseY);
    if (defaultsKey === graphDefaultsHashRef.current) return;
    if (store._userManualYAdjust) {
      graphDefaultsHashRef.current = defaultsKey;
      return;
    }

    const defaults = analyzeGraphDefaults(nodes, edges, contentFields, {
      useBaseY: store.terrainRefUseBaseY,
      materialConfig,
    });
    const applyDefaults = defaults.confidence === "high" || defaults.caveCarvingDetected === true;
    if (applyDefaults) {
      const yChanged = defaults.suggestedYMin !== store.voxelYMin
        || defaults.suggestedYMax !== store.voxelYMax;
      const rangeChanged = defaults.suggestedRangeMin !== store.rangeMin
        || defaults.suggestedRangeMax !== store.rangeMax;
      const yLevelChanged = defaults.suggestedYLevel != null
        && defaults.suggestedYLevel !== store.yLevel;
      if (yChanged) {
        store.setVoxelYMin(defaults.suggestedYMin);
        store.setVoxelYMax(defaults.suggestedYMax);
      }
      if (defaults.suggestedYLevel != null && (yChanged || yLevelChanged)) {
        store.setYLevel(defaults.suggestedYLevel);
      }
      if (rangeChanged) {
        store.setRange(defaults.suggestedRangeMin, defaults.suggestedRangeMax);
      }
      if (defaults.featureTags && defaults.featureTags.length > 0 && (yChanged || yLevelChanged)) {
        const label = defaults.featureTags.join(", ");
        useToastStore.getState().addToast(
          `Preview auto-fit: ${label} — Y range adjusted`,
          "info",
        );
      }
      store._setAutoFitGraphHash(defaultsKey);
    }
    graphDefaultsHashRef.current = defaultsKey;
  }, [evalFingerprint, mode, show3DVolumeView, autoFitYEnabled, terrainRefUseBaseY]);

  useEffect(() => {
    const voxelLike = isVoxelViewMode(mode, show3DVolumeView);
    if (!voxelLike || !autoFitYEnabled) return;
    applyTerrainYBeforeEval(readVoxelEvalParams(mode, show3DVolumeView));
  }, [evalFingerprint, mode, show3DVolumeView, autoFitYEnabled, terrainRefUseBaseY]);

  // Instant tab switch: drop loading overlay when cached mesh matches current key.
  useEffect(() => {
    if (!isVoxelViewMode(mode, show3DVolumeView)) return;
    const store = usePreviewStore.getState();
    if (store.voxelEvalKey === voxelEvalKey && store.voxelMeshData) {
      setVoxelLoading(false);
      setVoxelEvalProgressRes(null);
    }
  }, [mode, show3DVolumeView, voxelEvalKey, setVoxelLoading, setVoxelEvalProgressRes]);

  useEffect(() => {
    unmountedRef.current = false;
    const keyForThisRun = voxelEvalKey;

    if (viewMode === "graph" || !autoRefresh) {
      setVoxelLoading(false);
      setVoxelEvalProgressRes(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    const store = usePreviewStore.getState();
    const cacheFresh = store.voxelEvalKey === voxelEvalKey && !!store.voxelMeshData;
    if (cacheFresh) {
      setVoxelLoading(false);
      setVoxelEvalProgressRes(null);
      return;
    }

    const editorNow = useEditorStore.getState();
    if (editorNow.nodes.length === 0) {
      setVoxelDensities(null);
      setVoxelError(null);
      setVoxelLoading(false);
      setVoxelEvalProgressRes(null);
      usePreviewStore.setState({ voxelDisplayedRes: null, voxelEvalKey: null, voxelMeshData: null });
      return;
    }

    const isVoxelView = isVoxelViewMode(store.mode, store.show3DVolumeView);
    const hasStaleMesh = !!store.voxelMeshData;
    const delay = isVoxelView && !hasStaleMesh ? 0 : debounceMs;

    if (isVoxelView && !hasStaleMesh) {
      setVoxelLoading(true);
      setVoxelError(null);
    }

    timerRef.current = setTimeout(() => {
      void (async () => {
        cancelVolumeEvaluation();
        const live = readVoxelEvalParams(
          usePreviewStore.getState().mode,
          usePreviewStore.getState().show3DVolumeView,
        );
        if (live.nodes.length === 0) return;

        const evalId = ++evalIdRef.current;
        const currentKey = computeVoxelEvalKey({
          evalFingerprint,
          rangeMin: live.rangeMin,
          rangeMax: live.rangeMax,
          yLevel: live.yLevel,
          voxelYMin: live.voxelYMin,
          voxelYMax: live.voxelYMax,
          voxelYSlices: live.voxelYSlices,
          targetRes: live.targetRes,
          showMaterialColors,
        });

        const progressive = useConfigStore.getState().enableProgressiveVoxel;
        const steps = buildProgressiveVolumeSteps(live.targetRes, live.voxelYSlices, progressive);
        const finalRes = steps[steps.length - 1]?.resolution ?? live.targetRes;

        const evalOptions = await buildVolumeEvalOptions(
          live.nodes,
          live.edges,
          live.contentFields,
          live.rangeMin,
          live.rangeMax,
          live.yLevel,
          useProjectStore.getState().projectPath,
        );
        const rootNodeId = live.selectedPreviewNodeId ?? live.outputNodeId ?? undefined;
        const sessionKey = computeVolumeSessionKey(
          live.nodes,
          live.edges,
          rootNodeId,
          evalOptions,
        );

        setVoxelEvalProgressRes(steps[0]?.resolution ?? null);

        const pipelineStart = performance.now();
        const finalYSlices = steps[steps.length - 1]?.ySlices ?? live.voxelYSlices;

        try {
          if (steps.length === 1) {
            const result = await evaluateVolumeInWorker({
              nodes: live.nodes,
              edges: live.edges,
              resolution: steps[0].resolution,
              rangeMin: live.rangeMin,
              rangeMax: live.rangeMax,
              yMin: live.voxelYMin,
              yMax: live.voxelYMax,
              ySlices: steps[0].ySlices,
              rootNodeId,
              options: evalOptions,
              sessionKey,
            });

            if (evalId !== evalIdRef.current || unmountedRef.current) return;

            finishVoxelFromVolume({
              nodes: live.nodes,
              edges: live.edges,
              result,
              rangeMin: live.rangeMin,
              rangeMax: live.rangeMax,
              voxelYMin: live.voxelYMin,
              voxelYMax: live.voxelYMax,
              yLevel: live.yLevel,
              rootNodeId,
              contentFields: live.contentFields,
              materialConfig: live.materialConfig,
              showMaterialColors,
              evalOptions,
              voxelEvalKey: currentKey,
            });
          } else {
            await evaluateVolumeProgressive(
              {
                sessionKey,
                nodes: live.nodes,
                edges: live.edges,
                rangeMin: live.rangeMin,
                rangeMax: live.rangeMax,
                yMin: live.voxelYMin,
                yMax: live.voxelYMax,
                rootNodeId,
                options: evalOptions,
                steps,
                pauseAfterFirst: steps.length > 1,
              },
              async (step) => {
                if (evalId !== evalIdRef.current || unmountedRef.current) return "abort";

                const isCoarse = step.stepIndex === 0;
                const isFinal = step.isFinal;
                const shouldMesh = isCoarse || isFinal;

                if (!shouldMesh) {
                  setVoxelLoading(false);
                  setVoxelEvalProgressRes(finalRes);
                  return;
                }

                if (isCoarse) {
                  await deferMainThreadWork(() => {});
                }

                if (evalId !== evalIdRef.current || unmountedRef.current) return "abort";

                const fresh = readVoxelEvalParams(
                  usePreviewStore.getState().mode,
                  usePreviewStore.getState().show3DVolumeView,
                );

                await deferMainThreadWork(() => {
                  finishVoxelFromVolume({
                    nodes: fresh.nodes,
                    edges: fresh.edges,
                    result: step,
                    rangeMin: fresh.rangeMin,
                    rangeMax: fresh.rangeMax,
                    voxelYMin: fresh.voxelYMin,
                    voxelYMax: fresh.voxelYMax,
                    yLevel: fresh.yLevel,
                    rootNodeId: fresh.selectedPreviewNodeId ?? fresh.outputNodeId ?? undefined,
                    contentFields: fresh.contentFields,
                    materialConfig: fresh.materialConfig,
                    showMaterialColors,
                    evalOptions,
                    previewPass: !isFinal,
                    clearProgressRes: isFinal,
                    voxelEvalKey: isFinal ? currentKey : undefined,
                  });
                });

                if (evalId !== evalIdRef.current || unmountedRef.current) return "abort";

                setVoxelLoading(false);
                setVoxelEvalProgressRes(isFinal ? null : finalRes);
              },
            );
          }

          if (evalId === evalIdRef.current && !unmountedRef.current) {
            setVoxelLoading(false);
            setVoxelEvalProgressRes(null);
            const voxelEval = useDevMetricsStore.getState().voxelEval;
            useDevMetricsStore.getState().reportEval({
              kind: "voxel",
              lane: voxelEval?.lane,
              durationMs: performance.now() - pipelineStart,
              resolution: finalRes,
              detail: `${finalRes}³×${finalYSlices}`,
              at: Date.now(),
            });
          }
        } catch (err) {
          if (err === "cancelled") {
            if (evalId === evalIdRef.current) {
              setVoxelLoading(false);
              setVoxelEvalProgressRes(null);
            }
            return;
          }
          if (evalId === evalIdRef.current) {
            setVoxelDensities(null);
            setVoxelError(`Voxel evaluation failed: ${err}`);
            setVoxelLoading(false);
            setVoxelEvalProgressRes(null);
          }
        }
      })();
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (latestVoxelEvalKeyRef.current !== keyForThisRun) {
        evalIdRef.current += 1;
        cancelVolumeEvaluation();
      }
    };
  }, [
    voxelEvalKey, mode, show3DVolumeView, viewMode, autoRefresh, debounceMs, showMaterialColors, evalFingerprint,
    setVoxelDensities, setVoxelLoading, setVoxelEvalProgressRes, setVoxelError,
  ]);

  useEffect(() => () => {
    unmountedRef.current = true;
    cancelVolumeEvaluation();
  }, []);
}
