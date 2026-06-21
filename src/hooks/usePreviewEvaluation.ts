import { useEffect, useMemo, useRef } from "react";

import { usePreviewStore } from "@/stores/previewStore";

import { useEditorStore } from "@/stores/editorStore";

import { evaluateInWorker, cancelEvaluation } from "@/utils/densityWorkerClient";

import { computePreviewFidelityScore } from "@/utils/graphDiagnostics";

import { useConfigStore } from "@/stores/configStore";

import { useProjectStore } from "@/stores/projectStore";

import { buildDensityEvalOptions } from "@/utils/buildDensityEvalOptions";

import { isPropEditingContext } from "@/utils/propEditingContext";

import { useEvaluationFingerprint } from "@/hooks/useEvaluationFingerprint";
import { resolvePreviewRootNodeId } from "@/utils/previewRootResolver";

import {
  buildDensityPreviewEvalSteps,
  resolve2dPreviewResolutionForZoom,
} from "@/utils/previewResolution";
import { useZoomEvalScale } from "@/hooks/useZoomEvalScale";



/**

 * Auto-evaluation hook for the preview panel.

 * Watches graph changes and preview control changes, then triggers

 * evaluation via the Web Worker with debouncing and cancellation.

 *

 * Mount via PreviewEvaluationHost once per editor shell (not inside PreviewPanel).

 */

export function usePreviewEvaluation() {

  const evalFingerprint = useEvaluationFingerprint();

  const editingContext = useEditorStore((s) => s.editingContext);

  const activeBiomeSection = useEditorStore((s) => s.activeBiomeSection);

  const resolution = usePreviewStore((s) => s.resolution);

  const rangeMin = usePreviewStore((s) => s.rangeMin);

  const rangeMax = usePreviewStore((s) => s.rangeMax);

  const yLevel = usePreviewStore((s) => s.yLevel);

  const viewMode = usePreviewStore((s) => s.viewMode);

  const previewAutoRefresh = usePreviewStore((s) => s.autoRefresh);
  const configAutoRefresh = useConfigStore((s) => s.autoRefresh);
  const autoRefresh = previewAutoRefresh && configAutoRefresh;

  const mode = usePreviewStore((s) => s.mode);

  const canvasScale = usePreviewStore((s) => s.canvasTransform.scale);

  const zoomEvalScale = useZoomEvalScale(canvasScale);

  const debounceMs = useConfigStore((s) => s.debounceMs);



  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const evalIdRef = useRef(0);

  const latestPreviewEvalKeyRef = useRef<string | null>(null);



  const previewEvalKey = useMemo(() => {

    if (isPropEditingContext(editingContext, activeBiomeSection)) return null;

    if (mode === "voxel" || mode === "world") return null;

    if (viewMode === "graph" || !autoRefresh) return null;



    const effectiveResolution = mode === "2d"
      ? resolve2dPreviewResolutionForZoom(resolution, zoomEvalScale)
      : resolution;

    return [

      evalFingerprint,

      mode,

      effectiveResolution,

      rangeMin,

      rangeMax,

      yLevel,

    ].join("|");

  }, [

    evalFingerprint,

    editingContext,

    activeBiomeSection,

    mode,

    viewMode,

    autoRefresh,

    resolution,

    zoomEvalScale,

    rangeMin,

    rangeMax,

    yLevel,

  ]);



  latestPreviewEvalKeyRef.current = previewEvalKey;



  useEffect(() => {

    if (!previewEvalKey) {

      const preview = usePreviewStore.getState();

      if (preview.isLoading) preview.setLoading(false);

      if (preview.previewError) preview.setPreviewError(null);

      return;

    }



    const store = usePreviewStore.getState();

    if (store.densityEvalKey === previewEvalKey && store.values) {

      store.setLoading(false);

      store.setPreviewError(null);

      return;

    }



    if (timerRef.current) clearTimeout(timerRef.current);

    const keyForThisRun = previewEvalKey;



    timerRef.current = setTimeout(async () => {

      const { nodes, edges, contentFields, outputNodeId, biomeSections } = useEditorStore.getState();

      const projectPath = useProjectStore.getState().projectPath;

      const preview = usePreviewStore.getState();

      const liveMode = preview.mode;

      const effectiveResolution = liveMode === "2d"
        ? resolve2dPreviewResolutionForZoom(preview.resolution, zoomEvalScale)
        : preview.resolution;



      if (nodes.length === 0) {

        preview.setValues(null, 0, 0);

        preview.setPreviewError(null);

        preview.setLoading(false);

        usePreviewStore.setState({ densityEvalKey: null });

        return;

      }



      const evalId = ++evalIdRef.current;

      if (!preview.values && !preview.isLoading) preview.setLoading(true);

      if (preview.previewError) preview.setPreviewError(null);



      const evalOptions = await buildDensityEvalOptions({
        nodes,
        edges,
        contentFields,
        projectPath,
        biomeSections,
      });

      const params = {

        nodes,

        edges,

        rangeMin: preview.rangeMin,

        rangeMax: preview.rangeMax,

        yLevel: preview.yLevel,

        rootNodeId: resolvePreviewRootNodeId({
          nodes,
          edges,
          selectedPreviewNodeId: preview.selectedPreviewNodeId,
          outputNodeId,
        }),

        options: evalOptions,

      };



      const steps = buildDensityPreviewEvalSteps(
        liveMode === "2d" ? "2d" : "3d",
        effectiveResolution,
      );

      const existingGridN = preview.values
        ? Math.round(Math.sqrt(preview.values.length))
        : 0;
      const evalSteps = existingGridN > 0 && steps[steps.length - 1] > existingGridN
        ? [steps[steps.length - 1]]
        : steps;



      try {

        for (const step of evalSteps) {

          if (evalId !== evalIdRef.current) return;

          const result = await evaluateInWorker({ ...params, resolution: step });

          if (evalId === evalIdRef.current) {

            preview.setValues(

              result.values,

              result.minValue,

              result.maxValue,

              result.p02Value,

              result.p98Value,

            );

          }

        }



        if (evalId === evalIdRef.current) {

          usePreviewStore.setState({ densityEvalKey: keyForThisRun });

          usePreviewStore.getState().setFidelityScore(computePreviewFidelityScore(nodes, edges));

        }

      } catch (err) {

        if (err === "cancelled") return;

        if (evalId === evalIdRef.current) {

          preview.setValues(null, 0, 0);

          preview.setPreviewError(`Preview evaluation failed: ${err}`);

          usePreviewStore.setState({ densityEvalKey: null });

        }

      } finally {

        if (evalId === evalIdRef.current && usePreviewStore.getState().isLoading) {

          usePreviewStore.getState().setLoading(false);

        }

      }

    }, debounceMs);



    return () => {

      if (timerRef.current) clearTimeout(timerRef.current);

      if (latestPreviewEvalKeyRef.current !== keyForThisRun) {

        evalIdRef.current += 1;

        cancelEvaluation();

      }

    };

  }, [previewEvalKey, debounceMs, zoomEvalScale]);

}



/**

 * Trigger a manual evaluation (ignores autoRefresh).

 */

export function triggerManualEvaluation() {
  const preview = usePreviewStore.getState();
  const { nodes, edges, contentFields, outputNodeId, editingContext, activeBiomeSection, biomeSections } = useEditorStore.getState();
  const projectPath = useProjectStore.getState().projectPath;



  if (isPropEditingContext(editingContext, activeBiomeSection)) {

    preview.setLoading(false);

    preview.setPreviewError(null);

    return;

  }



  if (nodes.length === 0) {

    preview.setValues(null, 0, 0);

    usePreviewStore.setState({ densityEvalKey: null });

    return;

  }



  const effectiveResolution = preview.mode === "2d"
    ? resolve2dPreviewResolutionForZoom(preview.resolution, preview.canvasTransform.scale)
    : preview.resolution;



  preview.setLoading(true);

  preview.setPreviewError(null);



  void (async () => {
    const evalOptions = await buildDensityEvalOptions({
      nodes,
      edges,
      contentFields,
      projectPath,
      biomeSections,
    });

    evaluateInWorker({

      nodes,

      edges,

      resolution: effectiveResolution,

      rangeMin: preview.rangeMin,

      rangeMax: preview.rangeMax,

      yLevel: preview.yLevel,

      rootNodeId: resolvePreviewRootNodeId({
        nodes,
        edges,
        selectedPreviewNodeId: preview.selectedPreviewNodeId,
        outputNodeId,
      }),

      options: evalOptions,

    })

    .then((result) => {

      preview.setValues(result.values, result.minValue, result.maxValue, result.p02Value, result.p98Value);

      usePreviewStore.setState({ densityEvalKey: "manual" });

    })

    .catch((err) => {

      if (err === "cancelled") return;

      preview.setValues(null, 0, 0);

      preview.setPreviewError(`Preview evaluation failed: ${err}`);

      usePreviewStore.setState({ densityEvalKey: null });

    })

    .finally(() => {

      preview.setLoading(false);

    });
  })();

}


