import { useCallback, useMemo } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { useEditorStore } from "@/stores/editorStore";
import { SliderField } from "@/components/properties/SliderField";
import { runFitToContent, fitToContentBoundsFromResult } from "@/utils/previewAutoFit";
import { resolveTerrainReferenceLevels } from "@/utils/terrainPreviewLevel";
import {
  PreviewCheckbox,
  PreviewSidebarSection,
  previewButtonClass,
} from "./PreviewControlPrimitives";

export function ControlsVoxel() {
  const rangeMin = usePreviewStore((s) => s.rangeMin);
  const rangeMax = usePreviewStore((s) => s.rangeMax);
  const setRange = usePreviewStore((s) => s.setRange);
  const voxelYMin = usePreviewStore((s) => s.voxelYMin);
  const setVoxelYMin = usePreviewStore((s) => s.setVoxelYMin);
  const voxelYMax = usePreviewStore((s) => s.voxelYMax);
  const setVoxelYMax = usePreviewStore((s) => s.setVoxelYMax);
  const voxelYSlices = usePreviewStore((s) => s.voxelYSlices);
  const setVoxelYSlices = usePreviewStore((s) => s.setVoxelYSlices);
  const voxelResolution = usePreviewStore((s) => s.voxelResolution);
  const setVoxelResolution = usePreviewStore((s) => s.setVoxelResolution);
  const showMaterialColors = usePreviewStore((s) => s.showMaterialColors);
  const setShowMaterialColors = usePreviewStore((s) => s.setShowMaterialColors);
  const showVoxelWireframe = usePreviewStore((s) => s.showVoxelWireframe);
  const setShowVoxelWireframe = usePreviewStore((s) => s.setShowVoxelWireframe);
  const showMaterialLegend = usePreviewStore((s) => s.showMaterialLegend);
  const setShowMaterialLegend = usePreviewStore((s) => s.setShowMaterialLegend);
  const showWaterPlane = usePreviewStore((s) => s.showWaterPlane);
  const setShowWaterPlane = usePreviewStore((s) => s.setShowWaterPlane);
  const showFog3D = usePreviewStore((s) => s.showFog3D);
  const setShowFog3D = usePreviewStore((s) => s.setShowFog3D);
  const showSky3D = usePreviewStore((s) => s.showSky3D);
  const setShowSky3D = usePreviewStore((s) => s.setShowSky3D);
  const showSSAO = usePreviewStore((s) => s.showSSAO);
  const setShowSSAO = usePreviewStore((s) => s.setShowSSAO);
  const showEdgeOutline = usePreviewStore((s) => s.showEdgeOutline);
  const setShowEdgeOutline = usePreviewStore((s) => s.setShowEdgeOutline);
  const autoFitYEnabled = usePreviewStore((s) => s.autoFitYEnabled);
  const setAutoFitYEnabled = usePreviewStore((s) => s.setAutoFitYEnabled);
  const terrainRefUseBaseY = usePreviewStore((s) => s.terrainRefUseBaseY);
  const isFitToContentRunning = usePreviewStore((s) => s.isFitToContentRunning);
  const cutawayEnabled = usePreviewStore((s) => s.cutawayEnabled);
  const setCutawayEnabled = usePreviewStore((s) => s.setCutawayEnabled);
  const cutawayLevel = usePreviewStore((s) => s.cutawayLevel);
  const setCutawayLevel = usePreviewStore((s) => s.setCutawayLevel);
  const yLevel = usePreviewStore((s) => s.yLevel);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const contentFields = useEditorStore((s) => s.contentFields);

  const terrainRef = useMemo(
    () => resolveTerrainReferenceLevels(nodes, edges, contentFields, {
      useBaseY: terrainRefUseBaseY,
    }),
    [nodes, edges, contentFields, terrainRefUseBaseY],
  );

  const handleTerrainRefUseBaseY = useCallback((enabled: boolean) => {
    const store = usePreviewStore.getState();
    store.setTerrainRefUseBaseY(enabled);
    if (store.autoFitYEnabled) {
      store._setAutoFitGraphHash("");
      store._setUserManualYAdjust(false);
    }
  }, []);

  const handleYMinChange = useCallback((v: number) => {
    usePreviewStore.getState()._setUserManualYAdjust(true);
    setVoxelYMin(v);
  }, [setVoxelYMin]);

  const handleYMaxChange = useCallback((v: number) => {
    usePreviewStore.getState()._setUserManualYAdjust(true);
    setVoxelYMax(v);
  }, [setVoxelYMax]);

  const handleFitToContent = useCallback(async () => {
    const store = usePreviewStore.getState();
    store.setFitToContentRunning(true);

    const editorState = useEditorStore.getState();
    const result = await runFitToContent(
      editorState.nodes,
      editorState.edges,
      editorState.contentFields,
      editorState.outputNodeId ?? undefined,
      store.selectedPreviewNodeId ?? undefined,
    );

    if (result?.hasSolids) {
      const apply = fitToContentBoundsFromResult(result);
      if (apply) {
        store.setRange(apply.rangeMin, apply.rangeMax);
        store.setVoxelYMin(apply.voxelYMin);
        store.setVoxelYMax(apply.voxelYMax);
        store._setUserManualYAdjust(true);
      }
    }

    store.setFitToContentRunning(false);
  }, []);

  return (
    <PreviewSidebarSection title="Voxel mesh" headingId="preview-voxel-heading">
      <SliderField label="Range min" value={rangeMin} min={-256} max={0} step={1} onChange={(v) => setRange(v, rangeMax)} />
      <SliderField label="Range max" value={rangeMax} min={0} max={256} step={1} onChange={(v) => setRange(rangeMin, v)} />

      <button
        type="button"
        onClick={handleFitToContent}
        disabled={isFitToContentRunning}
        className={`w-full ${previewButtonClass}`}
      >
        {isFitToContentRunning ? "Scanning…" : "Fit to content"}
      </button>

      <SliderField
        label="Resolution"
        value={voxelResolution}
        min={8}
        max={256}
        step={8}
        allowInputOverflow
        onChange={setVoxelResolution}
      />
      <SliderField label="Y min" value={voxelYMin} min={-128} max={319} step={1} onChange={handleYMinChange} />
      <SliderField label="Y max" value={voxelYMax} min={-127} max={320} step={1} onChange={handleYMaxChange} />
      {terrainRef && (
        <p className="text-[10px] text-tn-text-muted leading-snug">
          Terrain ref: {terrainRef.baseHeightName} Y={terrainRef.referenceY}
          {!terrainRefUseBaseY && terrainRef.suggestedYLevel !== terrainRef.referenceY
            ? ` · nominal surface Y≈${terrainRef.suggestedYLevel}`
            : terrainRefUseBaseY ? " · anchored to Base Y" : ""}
          {terrainRef.bedrockY != null ? ` · bedrock Y=${terrainRef.bedrockY}` : ""}
        </p>
      )}
      <SliderField label="Y slices" value={voxelYSlices} min={8} max={128} step={4} onChange={setVoxelYSlices} />

      <fieldset className="flex flex-col gap-0.5 border-0 p-0 m-0 min-w-0">
        <legend className="text-[10px] font-medium text-tn-text-muted mb-1 px-0">Cave visibility</legend>
        <PreviewCheckbox
          checked={cutawayEnabled}
          onChange={setCutawayEnabled}
          label="Cutaway (hide above Y)"
          description="Clip the mesh above a world Y to see underground tunnels."
        />
        {cutawayEnabled && (
          <SliderField
            label="Cutaway Y"
            value={cutawayLevel}
            min={voxelYMin}
            max={voxelYMax}
            step={1}
            onChange={setCutawayLevel}
          />
        )}
        <button
          type="button"
          className={previewButtonClass}
          onClick={() => setCutawayLevel(yLevel)}
        >
          Sync cutaway to 2D Y level ({yLevel})
        </button>
      </fieldset>

      <fieldset className="flex flex-col gap-0.5 border-0 p-0 m-0 min-w-0">
        <legend className="text-[10px] font-medium text-tn-text-muted mb-1 px-0">Display</legend>
        <PreviewCheckbox checked={autoFitYEnabled} onChange={setAutoFitYEnabled} label="Auto-fit Y range" />
        <PreviewCheckbox
          checked={terrainRefUseBaseY}
          onChange={handleTerrainRefUseBaseY}
          label="Anchor terrain ref to Base Y"
          description="Use ContentFields Base for auto-fit and 2D Y level instead of the height-curve zero-crossing."
        />
        <PreviewCheckbox checked={showMaterialColors} onChange={setShowMaterialColors} label="Material colors" />
        <PreviewCheckbox checked={showVoxelWireframe} onChange={setShowVoxelWireframe} label="Wireframe" />
        <PreviewCheckbox checked={showMaterialLegend} onChange={setShowMaterialLegend} label="Material legend" />
        <PreviewCheckbox checked={showWaterPlane} onChange={setShowWaterPlane} label="Water plane" />
        <PreviewCheckbox checked={showFog3D} onChange={setShowFog3D} label="Fog" />
        <PreviewCheckbox checked={showSky3D} onChange={setShowSky3D} label="Sky" />
        <PreviewCheckbox checked={showSSAO} onChange={setShowSSAO} label="SSAO" />
        <PreviewCheckbox checked={showEdgeOutline} onChange={setShowEdgeOutline} label="Edge outline" />
      </fieldset>
    </PreviewSidebarSection>
  );
}
