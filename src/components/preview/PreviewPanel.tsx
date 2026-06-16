import { lazy, Suspense, useCallback, useRef, useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePreviewStore } from "@/stores/previewStore";
import { useVoxelEvaluation } from "@/hooks/useVoxelEvaluation";
import { useWorldPreview } from "@/hooks/useWorldPreview";
import { usePositionOverlay } from "@/hooks/usePositionOverlay";
import { useShapePreviewEvaluation } from "@/hooks/useShapePreviewEvaluation";
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
import { usePropEditingContext } from "@/hooks/usePropEditingContext";
import { usePropPlacementStore } from "@/stores/propPlacementStore";
import { PerformanceOverlay } from "@/components/dev/PerformanceOverlay";
import { PreviewStatusOverlays } from "./PreviewStatusOverlays";
import { PreviewChrome } from "./PreviewChrome";
import { PreviewControlsSidebar } from "./PreviewControlsSidebar";
import { usePreviewTarget } from "@/hooks/usePreviewTarget";
import { getUniformSlicePreviewHint } from "@/utils/previewSliceHints";
import { getPreviewTargetGuidance } from "@/utils/densityNoInlinePreview";

// Lazy-load heavy 3D components to avoid loading Three.js until needed
const Preview3D = lazy(() => import("./Preview3D").then(m => ({ default: m.Preview3D })));
const VoxelPreview3D = lazy(() => import("./VoxelPreview3D").then(m => ({ default: m.VoxelPreview3D })));

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
  useVerticalCrossSection();

  const { isPropContext } = usePropEditingContext();
  const propEvaluating = usePropPlacementStore((s) => s.isEvaluating);
  const propError = usePropPlacementStore((s) => s.evaluationError);
  const {
    mode, values, isLoading, previewError, showCrossSection, crossSectionLine, crossSectionProfileMode,
    show3DVolumeView, showThresholdView, usgsTopoStyle, isVoxelLoading, voxelError, voxelDensities,
    isWorldLoading, worldError, voxelMeshData, viewMode,
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
      usgsTopoStyle: s.usgsTopoStyle,
      isVoxelLoading: s.isVoxelLoading,
      voxelError: s.voxelError,
      voxelDensities: s.voxelDensities,
      isWorldLoading: s.isWorldLoading,
      worldError: s.worldError,
      voxelMeshData: s.voxelMeshData,
      viewMode: s.viewMode,
    })),
  );
  const useThresholdedHeatmap = showThresholdView && !usgsTopoStyle;

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
      || isWorldLoading;
  const anyError = isPropContext
    ? propError
    : previewError || voxelError || worldError;
  const hasData = isPropContext
    ? true
    : mode === "world"
      ? !!voxelMeshData
      : mode === "voxel"
        ? !!voxelMeshData || !!voxelDensities
        : mode === "3d" && show3DVolumeView
          ? !!voxelMeshData || !!voxelDensities
          : !!values;

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
