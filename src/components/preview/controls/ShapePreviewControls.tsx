import { useEffect, useMemo } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewTarget } from "@/hooks/usePreviewTarget";
import { getNodeType } from "@/utils/density/evalTypes";
import {
  defaultShapeLayersForType,
  getShapePreviewProfile,
  isSdfType,
} from "@/utils/shapePreview/shapePreviewProfile";
import {
  isLikelyOriginCenteredSdfVoxelRange,
  SDF_DEFAULT_VOXEL_Y,
} from "@/utils/shapePreview/sdfPreviewDefaults";
import { SHAPE_PREVIEW_COMBINER_TYPES } from "@/utils/shapePreview/combinerShapePreview";
import { getShapePreviewHints } from "@/utils/shapePreview/shapePreviewHints";
import {
  getShapePreviewModeHint,
  shouldShowShapeCellMap,
} from "@/utils/shapePreview/previewModeRouting";
import { resolveShapePreviewMeshNodeId } from "@/utils/shapePreview/resolveShapePreviewMesh";
import { SliderField } from "@/components/properties/SliderField";
import { useShapePreviewSliceY } from "@/hooks/useShapePreviewSliceY";
import { ShapeCellMap } from "@/components/preview/ShapeCellMap";
import {
  PreviewCallout,
  PreviewCheckbox,
  PreviewHintList,
  PreviewSidebarSection,
  previewChip,
} from "./PreviewControlPrimitives";

export function ShapePreviewControls() {
  const mode = usePreviewStore((s) => s.mode);
  const setMode = usePreviewStore((s) => s.setMode);
  const shapeSliceY = useShapePreviewSliceY();
  const showShapePreview = usePreviewStore((s) => s.showShapePreview);
  const setShowShapePreview = usePreviewStore((s) => s.setShowShapePreview);
  const showShapeCellMap = usePreviewStore((s) => s.showShapeCellMap);
  const setShowShapeCellMap = usePreviewStore((s) => s.setShowShapeCellMap);
  const showCellBoundaries = usePreviewStore((s) => s.showCellBoundaries);
  const setShowCellBoundaries = usePreviewStore((s) => s.setShowCellBoundaries);
  const showWallDistance = usePreviewStore((s) => s.showWallDistance);
  const setShowWallDistance = usePreviewStore((s) => s.setShowWallDistance);
  const showMeshSamples = usePreviewStore((s) => s.showMeshSamples);
  const setShowMeshSamples = usePreviewStore((s) => s.setShowMeshSamples);
  const showSdfSurface = usePreviewStore((s) => s.showSdfSurface);
  const setShowSdfSurface = usePreviewStore((s) => s.setShowSdfSurface);
  const shapePreviewSeed = usePreviewStore((s) => s.shapePreviewSeed);
  const setShapePreviewSeed = usePreviewStore((s) => s.setShapePreviewSeed);
  const applyShapePreviewPreset = usePreviewStore((s) => s.applyShapePreviewPreset);
  const yLevel = usePreviewStore((s) => s.yLevel);
  const setYLevel = usePreviewStore((s) => s.setYLevel);
  const voxelYMin = usePreviewStore((s) => s.voxelYMin);
  const voxelYMax = usePreviewStore((s) => s.voxelYMax);
  const setVoxelYMin = usePreviewStore((s) => s.setVoxelYMin);
  const setVoxelYMax = usePreviewStore((s) => s.setVoxelYMax);
  const selectedPreviewNodeId = usePreviewStore((s) => s.selectedPreviewNodeId);
  const shapePreviewMeshPoints = usePreviewStore((s) => s.shapePreviewMeshPoints);

  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const outputNodeId = useEditorStore((s) => s.outputNodeId);

  const {
    previewTargetType,
    previewTargetLabel,
    graphSelectionDiffers,
    syncFromGraphSelection,
  } = usePreviewTarget();

  const isCombiner =
    !!previewTargetType && SHAPE_PREVIEW_COMBINER_TYPES.has(previewTargetType);
  const profile = previewTargetType ? getShapePreviewProfile(previewTargetType) : null;
  const showCellLayerToggles = !profile || profile.cells || isCombiner;
  const showMeshLayerToggle = !profile || profile.mesh || isCombiner;
  const showSdfLayerToggle = !profile || profile.sdfZero || isCombiner;
  const showCellMapOption =
    !!previewTargetType && shouldShowShapeCellMap(previewTargetType);

  const modeHint = useMemo(
    () => getShapePreviewModeHint(previewTargetType),
    [previewTargetType],
  );

  const hints = useMemo(
    () =>
      getShapePreviewHints(nodes, edges, selectedPreviewNodeId, outputNodeId, {
        showShapePreview,
        showCellBoundaries,
        showWallDistance,
        showMeshSamples,
        showSdfSurface,
      }, { yMin: voxelYMin, yMax: voxelYMax, mode }),
    [
      nodes,
      edges,
      selectedPreviewNodeId,
      outputNodeId,
      showShapePreview,
      showCellBoundaries,
      showWallDistance,
      showMeshSamples,
      showSdfSurface,
      voxelYMin,
      voxelYMax,
      mode,
    ],
  );

  const pcnPresetActive =
    showCellBoundaries && showWallDistance && !showMeshSamples && !showSdfSurface;
  const pcnMeshPresetActive =
    showCellBoundaries && showWallDistance && showMeshSamples && !showSdfSurface;
  const sdfPresetActive =
    !showCellBoundaries && !showWallDistance && !showMeshSamples && showSdfSurface;

  useEffect(() => {
    if (!selectedPreviewNodeId) return;
    const node = nodes.find((n) => n.id === selectedPreviewNodeId);
    if (!node) return;
    const type = getNodeType(node);
    if (SHAPE_PREVIEW_COMBINER_TYPES.has(type)) return;

    const defaults = defaultShapeLayersForType(type);
    const meshWired = !!resolveShapePreviewMeshNodeId(nodes, edges, selectedPreviewNodeId);
    setShowCellBoundaries(defaults.showCellBoundaries);
    setShowWallDistance(defaults.showWallDistance);
    setShowMeshSamples(meshWired || defaults.showMeshSamples);
    setShowSdfSurface(defaults.showSdfSurface);
    if (isSdfType(type) && isLikelyOriginCenteredSdfVoxelRange(voxelYMin, voxelYMax)) {
      setVoxelYMin(SDF_DEFAULT_VOXEL_Y.min);
      setVoxelYMax(SDF_DEFAULT_VOXEL_Y.max);
      setYLevel(0);
    }
    if (shouldShowShapeCellMap(type)) {
      setShowShapeCellMap(true);
    }
  }, [
    selectedPreviewNodeId,
    nodes,
    edges,
    setShowCellBoundaries,
    setShowWallDistance,
    setShowMeshSamples,
    setShowSdfSurface,
    voxelYMin,
    voxelYMax,
    setVoxelYMin,
    setVoxelYMax,
    setYLevel,
    setShowShapeCellMap,
  ]);

  return (
    <PreviewSidebarSection
      title="Shape preview"
      headingId="shape-preview-heading"
      className="gap-3"
    >
      <p className="text-[10px] text-tn-text-muted leading-snug">
        Target:{" "}
        <span className="font-mono text-tn-text" title={previewTargetLabel}>
          {previewTargetLabel}
        </span>
        <span className="block mt-0.5">Set via Preview target above.</span>
      </p>

      {graphSelectionDiffers && (
        <button
          type="button"
          onClick={syncFromGraphSelection}
          className="text-left text-[10px] text-tn-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent rounded"
        >
          Use selected graph node as target
        </button>
      )}

      <PreviewCheckbox
        checked={showShapePreview}
        onChange={setShowShapePreview}
        label="Shape layers on preview"
        description="Cell walls, mesh dots, and SDF contours"
      />

      {modeHint && mode !== modeHint.recommended && (
        <PreviewCallout
          tone="warning"
          actionLabel={`Switch to ${modeHint.recommended.toUpperCase()} preview`}
          onAction={() => setMode(modeHint.recommended)}
        >
          {modeHint.reason}
        </PreviewCallout>
      )}

      <PreviewHintList hints={hints} />

      {showShapePreview && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium text-tn-text-muted">Presets</span>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Shape layer presets">
              <button
                type="button"
                aria-pressed={pcnPresetActive}
                onClick={() => applyShapePreviewPreset("pcn")}
                className={previewChip(pcnPresetActive)}
              >
                PCN cells
              </button>
              <button
                type="button"
                aria-pressed={pcnMeshPresetActive}
                onClick={() => applyShapePreviewPreset("pcnMesh")}
                className={previewChip(pcnMeshPresetActive)}
              >
                PCN + mesh
              </button>
              <button
                type="button"
                aria-pressed={sdfPresetActive}
                onClick={() => applyShapePreviewPreset("sdf")}
                className={previewChip(sdfPresetActive)}
              >
                SDF only
              </button>
            </div>
          </div>

          <fieldset className="flex flex-col gap-0.5 border-0 p-0 m-0 min-w-0">
            <legend className="text-[10px] font-medium text-tn-text-muted mb-1 px-0">
              Layers
            </legend>
            {showCellLayerToggles && (
              <>
                <PreviewCheckbox
                  checked={showCellBoundaries}
                  onChange={setShowCellBoundaries}
                  label="Cell boundaries"
                />
                <PreviewCheckbox
                  checked={showWallDistance}
                  onChange={setShowWallDistance}
                  label="Wall distance tint"
                />
              </>
            )}
            {showMeshLayerToggle && (
              <PreviewCheckbox
                checked={showMeshSamples}
                onChange={setShowMeshSamples}
                label="Mesh samples"
              />
            )}
            {showSdfLayerToggle && (
              <PreviewCheckbox
                checked={showSdfSurface}
                onChange={setShowSdfSurface}
                label="SDF surface (density = 0)"
              />
            )}
          </fieldset>

          {showCellMapOption && (
            <>
              <PreviewCheckbox
                checked={showShapeCellMap}
                onChange={setShowShapeCellMap}
                label="Cell map (top-down)"
                description="XZ layout in the sidebar — best in 2D mode"
              />
              {mode === "2d" && showShapeCellMap && <ShapeCellMap />}
              {mode !== "2d" && showShapeCellMap && (
                <PreviewCallout tone="info">
                  Cell map renders in 2D mode. Switch preview mode to 2D to view it.
                </PreviewCallout>
              )}
            </>
          )}

          {showMeshSamples && (
            <SliderField
              label="Mesh seed"
              value={shapePreviewSeed}
              min={0}
              max={999}
              step={1}
              onChange={setShapePreviewSeed}
            />
          )}

          {shapePreviewMeshPoints.length > 0 && (
            <p className="text-[10px] text-tn-text-muted tabular-nums">
              {shapePreviewMeshPoints.length.toLocaleString()} mesh points in range
            </p>
          )}

          {(mode === "voxel" || mode === "world") && (
            <div className="flex flex-col gap-1 border-t border-tn-border/60 pt-2">
              <span className="text-[10px] font-medium text-tn-text-muted">Voxel slice</span>
              <SliderField
                label="Slice Y (Y level)"
                value={yLevel}
                min={voxelYMin}
                max={voxelYMax}
                step={1}
                onChange={setYLevel}
              />
              <p className="text-[10px] text-tn-text-muted tabular-nums">
                Evaluated at Y={shapeSliceY}
              </p>
            </div>
          )}
        </>
      )}
    </PreviewSidebarSection>
  );
}
