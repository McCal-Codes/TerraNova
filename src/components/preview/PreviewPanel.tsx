import { lazy, Suspense, useCallback, useRef, useState, useEffect } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { useVoxelEvaluation } from "@/hooks/useVoxelEvaluation";
import { useWorldPreview } from "@/hooks/useWorldPreview";
import { usePositionOverlay } from "@/hooks/usePositionOverlay";
import { useShapePreviewEvaluation } from "@/hooks/useShapePreviewEvaluation";
import { Heatmap2D } from "./Heatmap2D";
import { ThresholdedHeatmap } from "./ThresholdedHeatmap";
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
import { PreviewSettingsDrawer } from "./PreviewSettingsDrawer";
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
  const mode = usePreviewStore((s) => s.mode);
  const values = usePreviewStore((s) => s.values);
  const isLoading = usePreviewStore((s) => s.isLoading);
  const previewError = usePreviewStore((s) => s.previewError);
  const showCrossSection = usePreviewStore((s) => s.showCrossSection);
  const crossSectionLine = usePreviewStore((s) => s.crossSectionLine);
  const crossSectionProfileMode = usePreviewStore((s) => s.crossSectionProfileMode);
  const show3DVolumeView = usePreviewStore((s) => s.show3DVolumeView);
  const showThresholdView = usePreviewStore((s) => s.showThresholdView);
  const usgsTopoStyle = usePreviewStore((s) => s.usgsTopoStyle);
  const useThresholdedHeatmap = showThresholdView && !usgsTopoStyle;
  const isVoxelLoading = usePreviewStore((s) => s.isVoxelLoading);
  const voxelError = usePreviewStore((s) => s.voxelError);
  const voxelDensities = usePreviewStore((s) => s.voxelDensities);
  const isWorldLoading = usePreviewStore((s) => s.isWorldLoading);
  const worldError = usePreviewStore((s) => s.worldError);
  const voxelMeshData = usePreviewStore((s) => s.voxelMeshData);
  const viewMode = usePreviewStore((s) => s.viewMode);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSettingsOpen(false);
  }, [viewMode]);

  const fidelityScore = usePreviewStore((s) => s.fidelityScore);
  const minValue = usePreviewStore((s) => s.minValue);
  const maxValue = usePreviewStore((s) => s.maxValue);
  const yLevel = usePreviewStore((s) => s.yLevel);
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
          settingsButtonRef={settingsButtonRef}
        />
        <div className="relative min-h-0 flex-1">
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
          <PreviewSettingsDrawer
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            returnFocusRef={settingsButtonRef}
            title="Prop preview settings"
          >
            <PropPreviewControls canExport={isCanvasReady} onExport={handleExportPreview} />
          </PreviewSettingsDrawer>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-tn-bg">
      <PreviewChrome
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
        settingsButtonRef={settingsButtonRef}
      />

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
            useThresholdedHeatmap
              ? (
                <ThresholdedHeatmap
                  ref={handleCanvasRef}
                  exportRootRef={(el) => { heatmapExportRootRef.current = el; }}
                />
              )
              : (
                <Heatmap2D
                  ref={handleCanvasRef}
                  exportRootRef={(el) => { heatmapExportRootRef.current = el; }}
                  sliceHint={topoSliceHint}
                />
              )
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
          <PreviewSettingsDrawer
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            returnFocusRef={settingsButtonRef}
          >
            <PreviewControls canExport={isCanvasReady} onExport={handleExportPreview} />
            {mode !== "voxel" && mode !== "world" && <StatisticsPanel />}
          </PreviewSettingsDrawer>
        </div>

        {/* Cross-section plot below main preview */}
        {mode === "2d" && !isPropContext && showCrossSection && crossSectionLine && values && (
          crossSectionProfileMode === "section"
            ? <VerticalCrossSectionPlot />
            : <CrossSectionPlot />
        )}
      </div>
    </div>
  );
}
