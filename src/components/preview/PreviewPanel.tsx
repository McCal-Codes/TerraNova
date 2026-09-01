import { lazy, Suspense, useCallback, useRef, useState, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePreviewStore } from "@/stores/previewStore";
import { useEditorStore } from "@/stores/editorStore";
import { useVoxelEvaluation } from "@/hooks/useVoxelEvaluation";
import { useWorldPreview } from "@/hooks/useWorldPreview";
import { usePositionOverlay } from "@/hooks/usePositionOverlay";
import { useShapePreviewEvaluation } from "@/hooks/useShapePreviewEvaluation";
import { useDensityPreviewModeRouting } from "@/hooks/useDensityPreviewModeRouting";
import { open } from "@tauri-apps/plugin-dialog";
import { readAssetFile } from "@/utils/ipc";
import type { PrefabJson } from "@/utils/prefabMeshBuilder";
import { loadTexturedPrefabFromJson } from "@/utils/hytaleBlockAssets/loadTexturedPrefabPreview";
import { useUIStore } from "@/stores/uiStore";
const Heatmap2D = lazy(() => import("./Heatmap2D").then((m) => ({ default: m.Heatmap2D })));
const ThresholdedHeatmap = lazy(() => import("./ThresholdedHeatmap").then((m) => ({ default: m.ThresholdedHeatmap })));
import { PreviewControls } from "./PreviewControls";
import { StatisticsPanel } from "./StatisticsPanel";
import { CrossSectionPlot } from "./CrossSectionPlot";
import { VerticalCrossSectionPlot } from "./VerticalCrossSectionPlot";
import { useVerticalCrossSection } from "@/hooks/useVerticalCrossSection";
import { exportHeatmapFromWrapper, exportPreviewCanvas } from "@/utils/exportPreview";
import { PropPreviewPanel } from "./PropPreviewPanel";
import { PropPreviewControls } from "./controls/PropPreviewControls";
import { usePropEditingContext, useAutoSplitOnPropSection } from "@/hooks/usePropEditingContext";
import {
  useMaterialEditingContext,
  useAutoSplitOnMaterialSection,
  useMaterialColumnPreview,
} from "@/hooks/useMaterialEditingContext";
import {
  MaterialPreviewPanel,
  MaterialPreviewControls,
  useMaterialPreviewSettings,
} from "./MaterialPreviewPanel";
import { usePropPlacementStore } from "@/stores/propPlacementStore";
import { PerformanceOverlay } from "@/components/dev/PerformanceOverlay";
import { PreviewStatusOverlays } from "./PreviewStatusOverlays";
import { PreviewApproximatedCallout } from "./PreviewApproximatedCallout";
import { listApproximatedNodesOnPreviewPath } from "@/utils/graphDiagnostics";
import { PreviewChrome } from "./PreviewChrome";
import { PreviewControlsSidebar } from "./PreviewControlsSidebar";
import { usePreviewTarget } from "@/hooks/usePreviewTarget";
import { getUniformSlicePreviewHint } from "@/utils/previewSliceHints";
import { getPreviewTargetGuidance } from "@/utils/densityNoInlinePreview";

// Lazy-load heavy 3D components to avoid loading Three.js until needed
const Preview3D = lazy(() => import("./Preview3D").then(m => ({ default: m.Preview3D })));
const VoxelPreview3D = lazy(() => import("./VoxelPreview3D").then(m => ({ default: m.VoxelPreview3D })));
const PrefabPreview3D = lazy(() => import("./PrefabPreview3D").then(m => ({ default: m.PrefabPreview3D })));

function Preview3DFallback() {
  return (
    <div className="flex items-center justify-center h-full text-sm text-tn-text-muted">
      Loading 3D preview...
    </div>
  );
}

export function PreviewPanel() {
  const setLegendVisible = usePreviewStore((s) => s.setShowMaterialLegend);
  const setShowWireframe = usePreviewStore((s) => s.setShowVoxelWireframe);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heatmapExportRootRef = useRef<HTMLDivElement | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  const handleCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    setIsCanvasReady(Boolean(el));
  }, []);

  const handleHeatmapExportRootRef = useCallback((el: HTMLDivElement | null) => {
    heatmapExportRootRef.current = el;
  }, []);

  const handleExportPreview = useCallback(async () => {
    const modeNow = usePreviewStore.getState().mode;
    if (modeNow === "2d" && heatmapExportRootRef.current) {
      await exportHeatmapFromWrapper(heatmapExportRootRef.current);
      return;
    }
    await exportPreviewCanvas(canvasRef.current);
  }, []);

  // Keyboard shortcuts for preview toggles
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Toggle material legend
      if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setLegendVisible(!usePreviewStore.getState().showMaterialLegend);
      }
      // Toggle wireframe (Ctrl+Shift+W to avoid conflicting with window close)
      if (e.key === "W" && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowWireframe(!usePreviewStore.getState().showVoxelWireframe);
      }
      // Screenshot
      if (e.key === "s" && e.altKey) {
        e.preventDefault();
        void handleExportPreview();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleExportPreview, setLegendVisible, setShowWireframe]);
  useVoxelEvaluation();
  useWorldPreview();
  usePositionOverlay();
  useShapePreviewEvaluation();
  useDensityPreviewModeRouting();
  useVerticalCrossSection();

  const { isPropContext } = usePropEditingContext();
  useAutoSplitOnPropSection(isPropContext);
  const { isMaterialContext } = useMaterialEditingContext();
  useAutoSplitOnMaterialSection(isMaterialContext);
  const materialPreviewSettings = useMaterialPreviewSettings();
  const materialPreview = useMaterialColumnPreview({
    preset: materialPreviewSettings.preset,
    view: materialPreviewSettings.view,
    surfaceY: materialPreviewSettings.surfaceY,
    useTerrainShape: materialPreviewSettings.useTerrainShape,
  });
  const propEvaluating = usePropPlacementStore((s) => s.isEvaluating);
  const propError = usePropPlacementStore((s) => s.evaluationError);
  const {
    mode, values, isLoading, previewError, showCrossSection, crossSectionLine, crossSectionProfileMode,
    show3DVolumeView, showThresholdView, mapStyle, isVoxelLoading, voxelError, voxelDensities,
    isWorldLoading, worldError, voxelMeshData, viewMode,
    prefabMeshData, texturedPrefabMesh, prefabTextureStats, isPrefabLoading, prefabError, prefabPath,
  } = usePreviewStore(
    useShallow((s) => ({
      mode: s.mode,
      values: s.values,
      isLoading: s.isLoading,
      previewError: s.previewError,
      showCrossSection: s.showCrossSection,
      crossSectionLine: s.crossSectionLine,
      crossSectionProfileMode: s.crossSectionProfileMode,
      show3DVolumeView: s.show3DVolumeView,
      showThresholdView: s.showThresholdView,
      mapStyle: s.mapStyle,
      isVoxelLoading: s.isVoxelLoading,
      voxelError: s.voxelError,
      voxelDensities: s.voxelDensities,
      isWorldLoading: s.isWorldLoading,
      worldError: s.worldError,
      voxelMeshData: s.voxelMeshData,
      viewMode: s.viewMode,
      prefabMeshData: s.prefabMeshData,
      texturedPrefabMesh: s.texturedPrefabMesh,
      prefabTextureStats: s.prefabTextureStats,
      isPrefabLoading: s.isPrefabLoading,
      prefabError: s.prefabError,
      prefabPath: s.prefabPath,
    })),
  );

  const setRequestedSettingsTab = useUIStore((s) => s.setRequestedSettingsTab);

  const handleLoadPrefab = useCallback(async () => {
    const store = usePreviewStore.getState();
    store.setPrefabError(null);
    store.setPrefabLoading(true);
    try {
      const selected = await open({
        title: "Open prefab",
        filters: [{ name: "Prefab JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (typeof selected !== "string") return;
      const raw = await readAssetFile(selected) as PrefabJson;
      if (!Array.isArray(raw?.blocks)) throw new Error("Not a valid .prefab.json — missing blocks array");
      const result = await loadTexturedPrefabFromJson(raw);
      store.setPrefabPath(selected);
      store.setPrefabMeshData(null);
      store.setTexturedPrefabMesh(result.mesh);
      store.setPrefabTextureStats({
        textured: result.texturedBlockTypes,
        total: result.totalBlockTypes,
        entityCount: result.entityCount,
      });
    } catch (err) {
      store.setPrefabError(String(err));
    } finally {
      store.setPrefabLoading(false);
    }
  }, []);
  // Both the topo and Hytale styles draw their own base image, so the threshold
  // view would just paint over them.
  const useThresholdedHeatmap = showThresholdView && mapStyle === "heat";
  const usgsTopoStyle = mapStyle === "usgs";

  const isSplitMode = viewMode === "split";
  const [controlsCollapsed, setControlsCollapsed] = useState(isSplitMode);

  useEffect(() => {
    setControlsCollapsed(isSplitMode);
  }, [isSplitMode]);

  const settingsOpen = !controlsCollapsed;
  const setSettingsOpen = useCallback((open: boolean) => {
    setControlsCollapsed(!open);
  }, []);

  const { fidelityScore, minValue, maxValue, yLevel } = usePreviewStore(
    useShallow((s) => ({ fidelityScore: s.fidelityScore, minValue: s.minValue, maxValue: s.maxValue, yLevel: s.yLevel })),
  );
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const approximatedPreviewNodes = useMemo(
    () => (!isPropContext && !isMaterialContext
      ? listApproximatedNodesOnPreviewPath(nodes, edges)
      : []),
    [nodes, edges, isPropContext, isMaterialContext],
  );
  const { previewTargetType, graphSelectionDiffers, previewTargetLabel } = usePreviewTarget();

  const previewHint = mode === "2d" && values
    ? (() => {
      const base = getPreviewTargetGuidance(previewTargetType)
        ?? getUniformSlicePreviewHint(previewTargetType, minValue, maxValue, yLevel);
      if (!base || !graphSelectionDiffers) return base;
      return `Preview target is ${previewTargetLabel} — sync it from canvas selection in settings if you meant the selected node. ${base}`;
    })()
    : null;
  const overlaySliceHint = mode === "2d" && usgsTopoStyle ? null : previewHint;
  const topoSliceHint = mode === "2d" && usgsTopoStyle ? previewHint : null;

  const anyLoading = isPropContext
    ? propEvaluating
    : isLoading
      || (isVoxelLoading && !voxelMeshData)
      || isWorldLoading
      || isPrefabLoading;
  const anyError = isPropContext
    ? propError
    : previewError || voxelError || worldError || prefabError;
  const hasData = isPropContext
    ? true
    : mode === "prefab"
      ? !!texturedPrefabMesh || !!prefabMeshData
      : mode === "world"
        ? !!voxelMeshData
        : mode === "voxel"
          ? !!voxelMeshData || !!voxelDensities
          : mode === "3d" && show3DVolumeView
            ? !!voxelMeshData || !!voxelDensities
            : !!values;

  if (isMaterialContext) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-tn-bg">
        <PreviewChrome
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
        />
        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          <PreviewControlsSidebar
            collapsed={controlsCollapsed}
            onCollapsedChange={setControlsCollapsed}
            ariaLabel="Material preview settings"
          >
            <MaterialPreviewControls settings={materialPreviewSettings} loading={materialPreview.loading} />
          </PreviewControlsSidebar>
          <div className="relative min-h-0 min-w-0 flex-1">
            <MaterialPreviewPanel settings={materialPreviewSettings} preview={materialPreview} />
          </div>
        </div>
      </div>
    );
  }

  if (isPropContext) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-tn-bg">
        <PreviewChrome
          isPropContext
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
        />
        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          <PreviewControlsSidebar
            collapsed={controlsCollapsed}
            onCollapsedChange={setControlsCollapsed}
            ariaLabel="Prop preview settings"
          >
            <PropPreviewControls canExport={isCanvasReady} onExport={handleExportPreview} />
          </PreviewControlsSidebar>
          <div className="relative min-h-0 min-w-0 flex-1">
            <PreviewStatusOverlays
              loading={anyLoading && !hasData}
              fidelityScore={fidelityScore}
              hasData={hasData}
              showFidelity={false}
            />
            {anyError && (
              <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-tn-bg/90">
                <p className="text-xs text-red-400 max-w-md text-center whitespace-pre-line">{anyError}</p>
              </div>
            )}
            {!anyError && <PropPreviewPanel />}
            <PerformanceOverlay />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-tn-bg">
      <PreviewChrome
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
        <PreviewControlsSidebar
          collapsed={controlsCollapsed}
          onCollapsedChange={setControlsCollapsed}
        >
          <PreviewControls canExport={isCanvasReady} onExport={handleExportPreview} />
          {mode !== "voxel" && mode !== "world" && <StatisticsPanel />}
        </PreviewControlsSidebar>

        <div className="flex min-w-0 flex-1 flex-col min-h-0">
          <div className="relative min-h-0 flex-1">
            <PreviewStatusOverlays
              loading={anyLoading && !hasData}
              fidelityScore={fidelityScore}
              hasData={hasData}
              showFidelity={!isPropContext}
              sliceHint={overlaySliceHint}
            />
            {hasData && approximatedPreviewNodes.length > 0 && (
              <PreviewApproximatedCallout nodes={approximatedPreviewNodes} />
            )}

            {anyError && !hasData && (
              <div className="flex items-center justify-center h-full p-4">
                <p className="text-xs text-red-400 max-w-md text-center whitespace-pre-line">{anyError}</p>
              </div>
            )}

            {!hasData && !anyError && !anyLoading && (
              <div className="flex items-center justify-center h-full text-sm text-tn-text-muted">
                No preview data — open a density file to get started
              </div>
            )}

            {/* 2D mode */}
            {!isPropContext && mode === "2d" && values && (
              <Suspense fallback={<Preview3DFallback />}>
                {useThresholdedHeatmap
                  ? (
                    <ThresholdedHeatmap
                      ref={handleCanvasRef}
                      exportRootRef={handleHeatmapExportRootRef}
                    />
                  )
                  : (
                    <Heatmap2D
                      ref={handleCanvasRef}
                      exportRootRef={handleHeatmapExportRootRef}
                      sliceHint={topoSliceHint}
                    />
                  )}
              </Suspense>
            )}

            {/* 3D heightfield mode */}
            {!isPropContext && mode === "3d" && (values || show3DVolumeView) && (
              <Suspense fallback={<Preview3DFallback />}>
                <Preview3D onCanvasRef={handleCanvasRef} />
              </Suspense>
            )}

            {/* Voxel mode */}
            {!isPropContext && mode === "voxel" && (voxelDensities || isVoxelLoading || voxelError) && (
              <Suspense fallback={<Preview3DFallback />}>
                <VoxelPreview3D onCanvasRef={handleCanvasRef} />
              </Suspense>
            )}

            {/* World mode — reuses VoxelPreview3D with server chunk data */}
            {!isPropContext && mode === "world" && (voxelMeshData || isWorldLoading) && (
              <Suspense fallback={<Preview3DFallback />}>
                <VoxelPreview3D onCanvasRef={handleCanvasRef} />
              </Suspense>
            )}

            {/* Prefab mode — 1:1 block preview from .prefab.json */}
            {!isPropContext && mode === "prefab" && (
              <>
                {(texturedPrefabMesh || isPrefabLoading) && (
                  <Suspense fallback={<Preview3DFallback />}>
                    {texturedPrefabMesh ? (
                      <PrefabPreview3D mesh={texturedPrefabMesh} className="absolute inset-0 w-full h-full" />
                    ) : (
                      <Preview3DFallback />
                    )}
                  </Suspense>
                )}
                {!texturedPrefabMesh && !isPrefabLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <p className="text-sm text-tn-text-muted">
                      Load a <code className="font-mono text-xs bg-tn-surface px-1 py-0.5 rounded">.prefab.json</code> to preview it 1:1
                    </p>
                    <button
                      onClick={() => void handleLoadPrefab()}
                      className="px-4 py-2 text-sm rounded bg-tn-accent text-tn-bg font-medium hover:opacity-90"
                    >
                      Open prefab…
                    </button>
                  </div>
                )}
                {texturedPrefabMesh && (
                  <div className="absolute bottom-2 left-2 flex flex-col gap-1 pointer-events-none">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-tn-text-muted/70 bg-tn-bg/80 px-2 py-0.5 rounded font-mono truncate max-w-xs">
                        {prefabPath?.split(/[/\\]/).pop() ?? "prefab"}
                      </span>
                      <button
                        onClick={() => void handleLoadPrefab()}
                        className="pointer-events-auto text-[10px] px-2 py-0.5 rounded border border-tn-border hover:bg-tn-accent/15"
                      >
                        Load another
                      </button>
                    </div>
                    {prefabTextureStats && (
                      <div className="text-[10px] text-tn-text-muted/80 bg-tn-bg/80 px-2 py-0.5 rounded pointer-events-auto">
                        {texturedPrefabMesh.blockCount.toLocaleString()} blocks
                        {prefabTextureStats.entityCount > 0 ? ` · ${prefabTextureStats.entityCount} entities` : ""}
                        {prefabTextureStats.total > 0 && (
                          <>
                            {" · "}
                            {prefabTextureStats.textured > 0
                              ? `${prefabTextureStats.textured}/${prefabTextureStats.total} block types textured`
                              : "sync Hytale assets for block textures"}
                          </>
                        )}
                        {prefabTextureStats.total > 0 && prefabTextureStats.textured === 0 && (
                          <button
                            type="button"
                            onClick={() => setRequestedSettingsTab("assets")}
                            className="ml-2 text-[10px] font-medium text-tn-accent hover:text-tn-accent/80"
                          >
                            Sync Hytale assets…
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {prefabError && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded border border-red-800/60 bg-red-950/95 text-[11px] text-red-300 shadow-sm max-w-sm text-center">
                    {prefabError}
                  </div>
                )}
              </>
            )}

            <PerformanceOverlay />
          </div>

          {/* Cross-section plot below main preview */}
          {mode === "2d" && !isPropContext && showCrossSection && crossSectionLine && values && (
            crossSectionProfileMode === "section"
              ? <VerticalCrossSectionPlot />
              : <CrossSectionPlot />
          )}
        </div>
      </div>
    </div>
  );
}
