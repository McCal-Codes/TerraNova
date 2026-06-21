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
  computeEvaluationFingerprint,
  runFitToContent,
  refineFitToContentApply,
} from "@/utils/previewAutoFit";
import { analyzeGraphPreviewFeatures } from "@/utils/graphPreviewFeatures";
import {
  computeTerrainAutoFitYBounds,
  expandVoxelYBoundsToIncludeSurface,
  resolveTerrainReferenceLevels,
} from "@/utils/terrainPreviewLevel";
import { computeVolumeSessionKey, computeVoxelEvalKey } from "@/utils/volumeSessionKey";
import { buildProgressiveVolumeSteps } from "@/utils/volumeEvaluationCore";
import { finishVoxelFromVolume } from "@/utils/finishVoxelFromVolume";
import { useToastStore } from "@/stores/toastStore";
import { useDevMetricsStore } from "@/stores/devMetricsStore";

import { resolvePreviewRootForEvaluation, resolvePreviewRootNodeId, computeDensityVolumeStats } from "@/utils/previewRootResolver";
import { deferMainThreadWork } from "@/utils/deferMainThreadWork";

function isVoxelViewMode(mode: string, show3DVolumeView: boolean): boolean {
  return mode === "voxel" || (mode === "3d" && show3DVolumeView);
}

function volumeLooksSolidCube(stats: { min: number; positiveFraction: number }): boolean {
  return stats.min >= 0 && stats.positiveFraction > 0.95;
}

function tryRecoverSolidCubeVolume(live: ReturnType<typeof readVoxelEvalParams>): boolean {
  const store = usePreviewStore.getState();
  if (store._userManualYAdjust) return false;

  const expanded = expandSuggestedVoxelYBounds(
    live.voxelYMin,
    live.voxelYMax,
    live.nodes,
    live.edges,
    live.contentFields,
    {
      useBaseY: live.terrainRefUseBaseY,
      materialConfig: live.materialConfig,
      anchorY: live.yLevel,
    },
  );
  const yChanged = expanded.worldYMin !== live.voxelYMin || expanded.worldYMax !== live.voxelYMax;
  if (!yChanged) return false;

  store._setUserManualYAdjust(false);
  store._setAutoFitGraphHash("");
  store._setAutoFitContentGraphHash("");
  store.setVoxelYMin(expanded.worldYMin);
  store.setVoxelYMax(expanded.worldYMax);
  store.setVoxelMeshData(null);
  usePreviewStore.setState({ voxelEvalKey: null, voxelDensityStats: null });
  store.requestManualPreviewRefresh();
  useToastStore.getState().addToast(
    "Voxel window reframed — previous slice was all solid (no air).",
    "info",
  );
  return true;
}

/** Sync terrain Y from height profile — no density scan, no eval restart. */
function applyTerrainYBeforeEval(live: ReturnType<typeof readVoxelEvalParams>): boolean {
  const store = usePreviewStore.getState();
  if (!store.autoFitYEnabled || store._userManualYAdjust) return false;

  const autoFitKey = terrainAutoFitGraphKey(
    live.nodes,
    live.edges,
    live.contentFields,
    live.terrainRefUseBaseY,
  );
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
      rootNodeId: resolvePreviewRootNodeId({
        nodes: live.nodes,
        edges: live.edges,
        selectedPreviewNodeId: live.selectedPreviewNodeId,
        outputNodeId: live.outputNodeId,
      }),
      useBaseY: live.terrainRefUseBaseY,
      undergroundCarving: features.undergroundCarving,
      belowPad: features.belowPad,
    },
  );
  if (!terrainAutoFit) return false;

  const expanded = expandSuggestedVoxelYBounds(
    terrainAutoFit.worldYMin,
    terrainAutoFit.worldYMax,
    live.nodes,
    live.edges,
    live.contentFields,
    {
      useBaseY: live.terrainRefUseBaseY,
      materialConfig: live.materialConfig,
      anchorY: live.yLevel,
      undergroundCarving: features.undergroundCarving,
      belowPad: features.belowPad,
    },
  );

  const yChanged = expanded.worldYMin !== live.voxelYMin
    || expanded.worldYMax !== live.voxelYMax
    || terrainAutoFit.yLevel !== live.yLevel;
  if (!yChanged) return false;

  store.setVoxelYMin(expanded.worldYMin);
  store.setVoxelYMax(expanded.worldYMax);
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
    biomeSections: editor.biomeSections,
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
  biomeSections?: Record<string, { nodes: Node[]; edges: Edge[] }> | null,
) {
  const base = await buildDensityEvalOptions({
    nodes,
    edges,
    contentFields,
    projectPath,
    biomeSections,
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

function terrainAutoFitGraphKey(
  nodes: Node[],
  edges: Edge[],
  contentFields: Record<string, number>,
  useBaseY: boolean,
): string {
  const base = contentFields.Base ?? "";
  const water = contentFields.Water ?? "";
  const bedrock = contentFields.Bedrock ?? "";
  return `${computeGraphHash(nodes, edges)}|${useBaseY ? "baseY" : "profileZero"}|b=${base}|w=${water}|br=${bedrock}`;
}

function expandSuggestedVoxelYBounds(
  yMin: number,
  yMax: number,
  nodes: Node[],
  edges: Edge[],
  contentFields: Record<string, number>,
  options: {
    useBaseY: boolean;
    materialConfig: ReturnType<typeof useEditorStore.getState>["materialConfig"];
    anchorY: number;
    belowPad?: number;
    undergroundCarving?: boolean;
  },
): { worldYMin: number; worldYMax: number } {
  const features = analyzeGraphPreviewFeatures(
    nodes,
    edges,
    contentFields,
    options.materialConfig,
  );
  const terrainRef = resolveTerrainReferenceLevels(nodes, edges, contentFields, {
    useBaseY: options.useBaseY,
    belowPad: options.belowPad ?? features.belowPad,
    caveCarving: options.undergroundCarving ?? features.undergroundCarving,
  });
  if (!terrainRef) return { worldYMin: yMin, worldYMax: yMax };

  // When anchoring to Base Y, also ensure we include the profile zero-crossing band.
  // Otherwise Base+offset graphs (common with BaseHeight Distance stacks) can become "all-solid"
  // in the voxel window and render as a plain cube.
  const terrainRefProfile = options.useBaseY
    ? resolveTerrainReferenceLevels(nodes, edges, contentFields, {
      useBaseY: false,
      belowPad: options.belowPad ?? features.belowPad,
      caveCarving: options.undergroundCarving ?? features.undergroundCarving,
    })
    : null;

  const expandedA = expandVoxelYBoundsToIncludeSurface(yMin, yMax, terrainRef, {
    anchorY: options.anchorY,
  });
  const expandedB = terrainRefProfile
    ? expandVoxelYBoundsToIncludeSurface(expandedA.worldYMin, expandedA.worldYMax, terrainRefProfile, {
      anchorY: options.anchorY,
    })
    : expandedA;

  return expandedB;
}

/** Apply graph-derived voxel framing (XZ + Y). Returns true when store Y bounds changed. */
function applyVoxelGraphAutoFit(
  graphDefaultsHashRef: { current: string },
  force = false,
): boolean {
  const store = usePreviewStore.getState();
  if (!store.autoFitYEnabled || store._userManualYAdjust) return false;

  const { nodes, edges, contentFields, materialConfig, outputNodeId } = useEditorStore.getState();
  const defaultsKey = terrainAutoFitGraphKey(
    nodes,
    edges,
    contentFields,
    store.terrainRefUseBaseY,
  );
  if (!force && defaultsKey === graphDefaultsHashRef.current) return false;

  const defaults = analyzeGraphDefaults(nodes, edges, contentFields, {
    useBaseY: store.terrainRefUseBaseY,
    materialConfig,
    rootNodeId: resolvePreviewRootNodeId({
      nodes,
      edges,
      selectedPreviewNodeId: store.selectedPreviewNodeId,
      outputNodeId,
    }),
  });
  const applyDefaults = force || defaults.confidence === "high" || defaults.caveCarvingDetected === true;
  if (!applyDefaults) {
    graphDefaultsHashRef.current = defaultsKey;
    return false;
  }

  const expanded = expandSuggestedVoxelYBounds(
    defaults.suggestedYMin,
    defaults.suggestedYMax,
    nodes,
    edges,
    contentFields,
    {
      useBaseY: store.terrainRefUseBaseY,
      materialConfig,
      anchorY: store.yLevel,
    },
  );

  const yChanged = expanded.worldYMin !== store.voxelYMin
    || expanded.worldYMax !== store.voxelYMax;
  const rangeChanged = defaults.suggestedRangeMin !== store.rangeMin
    || defaults.suggestedRangeMax !== store.rangeMax;
  const yLevelChanged = defaults.suggestedYLevel != null
    && defaults.suggestedYLevel !== store.yLevel;
  const resChanged = defaults.suggestedVoxelResolution != null
    && defaults.suggestedVoxelResolution !== store.voxelResolution;
  const slicesChanged = defaults.suggestedVoxelYSlices != null
    && defaults.suggestedVoxelYSlices !== store.voxelYSlices;

  if (yChanged) {
    store.setVoxelYMin(expanded.worldYMin);
    store.setVoxelYMax(expanded.worldYMax);
  }
  if (defaults.suggestedYLevel != null && (yChanged || yLevelChanged)) {
    store.setYLevel(defaults.suggestedYLevel);
  }
  if (rangeChanged) {
    store.setRange(defaults.suggestedRangeMin, defaults.suggestedRangeMax);
  }
  if (resChanged) store.setVoxelResolution(defaults.suggestedVoxelResolution!);
  if (slicesChanged) store.setVoxelYSlices(defaults.suggestedVoxelYSlices!);
  if (defaults.featureTags && defaults.featureTags.length > 0 && (yChanged || yLevelChanged)) {
    const label = defaults.featureTags.join(", ");
    useToastStore.getState().addToast(
      `Preview auto-fit: ${label} — Y range adjusted`,
      "info",
    );
  }
  store._setAutoFitGraphHash(defaultsKey);
  graphDefaultsHashRef.current = defaultsKey;
  return yChanged;
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
  const manualPreviewRefreshToken = usePreviewStore((s) => s.manualPreviewRefreshToken);
  const showMaterialColors = usePreviewStore((s) => s.showMaterialColors);
  const autoFitYEnabled = usePreviewStore((s) => s.autoFitYEnabled);
  const autoFitContentEnabled = usePreviewStore((s) => s.autoFitContentEnabled);
  const terrainRefUseBaseY = usePreviewStore((s) => s.terrainRefUseBaseY);
  const setVoxelDensities = usePreviewStore((s) => s.setVoxelDensities);
  const setVoxelLoading = usePreviewStore((s) => s.setVoxelLoading);
  const setVoxelEvalProgressRes = usePreviewStore((s) => s.setVoxelEvalProgressRes);
  const setVoxelError = usePreviewStore((s) => s.setVoxelError);
  const debounceMs = useConfigStore((s) => s.debounceMs);

  useEffect(() => {
    solidCubeRecoveryRef.current = false;
    const editor = useEditorStore.getState();
    const preview = usePreviewStore.getState();
    usePreviewStore.setState({
      voxelRootResolution: resolvePreviewRootForEvaluation({
        nodes: editor.nodes,
        edges: editor.edges,
        selectedPreviewNodeId: preview.selectedPreviewNodeId,
        outputNodeId: editor.outputNodeId,
      }),
    });
  }, [evalFingerprint]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evalIdRef = useRef(0);
  const unmountedRef = useRef(false);
  const graphDefaultsHashRef = useRef("");
  const prevVoxelLikeRef = useRef(false);
  const lastManualRefreshTokenRef = useRef<number>(0);
  const contentFitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const solidCubeRecoveryRef = useRef(false);
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
    const enteredVoxel = voxelLike && !prevVoxelLikeRef.current;
    prevVoxelLikeRef.current = voxelLike;

    if (!voxelLike || !autoFitYEnabled) return;

    if (enteredVoxel) {
      graphDefaultsHashRef.current = "";
    }
    applyVoxelGraphAutoFit(graphDefaultsHashRef, enteredVoxel);
  }, [evalFingerprint, mode, show3DVolumeView, autoFitYEnabled, terrainRefUseBaseY]);

  useEffect(() => {
    const voxelLike = isVoxelViewMode(mode, show3DVolumeView);
    if (!voxelLike || !autoFitYEnabled || !autoFitContentEnabled) return;

    const store = usePreviewStore.getState();
    if (store._userManualYAdjust) return;

    const editor = useEditorStore.getState();
    if (editor.nodes.length === 0) return;

    const rootResolution = resolvePreviewRootForEvaluation({
      nodes: editor.nodes,
      edges: editor.edges,
      selectedPreviewNodeId: store.selectedPreviewNodeId,
      outputNodeId: editor.outputNodeId,
    });
    const contentKey = computeEvaluationFingerprint({
      nodes: editor.nodes,
      edges: editor.edges,
      contentFields: editor.contentFields,
      rootNodeId: rootResolution.nodeId,
      rootSource: rootResolution.source,
      materialConfig: editor.materialConfig,
    });
    if (contentKey === store._autoFitContentGraphHash) return;

    if (contentFitTimerRef.current) clearTimeout(contentFitTimerRef.current);

    contentFitTimerRef.current = setTimeout(() => {
      void (async () => {
        const liveStore = usePreviewStore.getState();
        if (liveStore._userManualYAdjust) return;

        const liveEditor = useEditorStore.getState();
        if (liveEditor.nodes.length === 0) return;

        liveStore.setFitToContentRunning(true);
        try {
          const bounds = await runFitToContent({
            nodes: liveEditor.nodes,
            edges: liveEditor.edges,
            contentFields: liveEditor.contentFields,
            outputNodeId: liveEditor.outputNodeId ?? undefined,
            selectedNodeId: resolvePreviewRootNodeId({
              nodes: liveEditor.nodes,
              edges: liveEditor.edges,
              selectedPreviewNodeId: liveStore.selectedPreviewNodeId,
              outputNodeId: liveEditor.outputNodeId,
            }),
            useBaseY: liveStore.terrainRefUseBaseY,
            materialConfig: liveEditor.materialConfig,
          });

          if (!bounds?.hasSolids) return;

          const apply = refineFitToContentApply(
            bounds,
            liveEditor.nodes,
            liveEditor.edges,
            liveEditor.contentFields,
            { useBaseY: liveStore.terrainRefUseBaseY, anchorY: liveStore.yLevel },
          );
          if (!apply) return;

          liveStore.setRange(apply.rangeMin, apply.rangeMax);
          liveStore.setVoxelYMin(apply.voxelYMin);
          liveStore.setVoxelYMax(apply.voxelYMax);
          if (apply.yLevel != null) liveStore.setYLevel(apply.yLevel);
          liveStore._setAutoFitContentGraphHash(contentKey);
        } finally {
          usePreviewStore.getState().setFitToContentRunning(false);
        }
      })();
    }, 400);

    return () => {
      if (contentFitTimerRef.current) clearTimeout(contentFitTimerRef.current);
    };
  }, [
    evalFingerprint,
    mode,
    show3DVolumeView,
    autoFitYEnabled,
    autoFitContentEnabled,
    terrainRefUseBaseY,
  ]);

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

    const hasManualRefresh = manualPreviewRefreshToken !== lastManualRefreshTokenRef.current;
    if (hasManualRefresh) {
      lastManualRefreshTokenRef.current = manualPreviewRefreshToken;
    }

    if (viewMode === "graph" || (!autoRefresh && !hasManualRefresh)) {
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
          live.biomeSections,
        );
        const rootResolution = resolvePreviewRootForEvaluation({
          nodes: live.nodes,
          edges: live.edges,
          selectedPreviewNodeId: live.selectedPreviewNodeId,
          outputNodeId: live.outputNodeId,
        });
        const rootNodeId = rootResolution.nodeId ?? undefined;
        usePreviewStore.setState({ voxelRootResolution: rootResolution });
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

            const stats = computeDensityVolumeStats(result.densities);
            if (
              !solidCubeRecoveryRef.current
              && volumeLooksSolidCube(stats)
              && tryRecoverSolidCubeVolume(live)
            ) {
              solidCubeRecoveryRef.current = true;
              return;
            }

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
              biomeSections: live.biomeSections,
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
                    rootNodeId: resolvePreviewRootNodeId({
                      nodes: fresh.nodes,
                      edges: fresh.edges,
                      selectedPreviewNodeId: fresh.selectedPreviewNodeId,
                      outputNodeId: fresh.outputNodeId,
                    }),
                    contentFields: fresh.contentFields,
                    materialConfig: fresh.materialConfig,
                    biomeSections: fresh.biomeSections,
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
    voxelEvalKey, mode, show3DVolumeView, viewMode, autoRefresh, manualPreviewRefreshToken, debounceMs, showMaterialColors, evalFingerprint,
    setVoxelDensities, setVoxelLoading, setVoxelEvalProgressRes, setVoxelError,
  ]);

  useEffect(() => () => {
    unmountedRef.current = true;
    cancelVolumeEvaluation();
  }, []);
}
