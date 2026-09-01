import { useCallback, useMemo } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import type { CutawayPreset } from "@/utils/previewCutaway";
import { useEditorStore } from "@/stores/editorStore";
import { SliderField } from "@/components/properties/SliderField";
import { runFitToContent, refineFitToContentApply } from "@/utils/previewAutoFit";
import { resolveTerrainReferenceLevels } from "@/utils/terrainPreviewLevel";
import { resolvePreviewRootNodeId } from "@/utils/previewRootResolver";
import {
  PreviewCheckbox,
  PreviewControlGroup,
  PreviewCallout,
  PreviewSidebarSection,
  previewButtonClass,
} from "./PreviewControlPrimitives";

/**
 * Two shapes, no per-axis controls. "Top" is previewable live on the GPU; "Corner"
 * keeps the surface visible around the notch and settles via re-extraction.
 */
const CUTAWAY_SHAPES: ReadonlyArray<{ value: CutawayPreset; label: string; title: string }> = [
  { value: "top", label: "Top", title: "Remove everything above the cut level" },
  { value: "corner", label: "Corner", title: "Remove one quadrant above the cut, keeping surface context" },
];

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
  const autoFitContentEnabled = usePreviewStore((s) => s.autoFitContentEnabled);
  const setAutoFitContentEnabled = usePreviewStore((s) => s.setAutoFitContentEnabled);
  const terrainRefUseBaseY = usePreviewStore((s) => s.terrainRefUseBaseY);
  const isFitToContentRunning = usePreviewStore((s) => s.isFitToContentRunning);
  const worldSeed = useEditorStore((s) => s.worldSeed);
  const setWorldSeed = useEditorStore((s) => s.setWorldSeed);
  const cutawayEnabled = usePreviewStore((s) => s.cutawayEnabled);
  const setCutawayEnabled = usePreviewStore((s) => s.setCutawayEnabled);
  const cutawayLevel = usePreviewStore((s) => s.cutawayLevel);
  const cutawayPreset = usePreviewStore((s) => s.cutawayPreset);
  const setCutawayPreset = usePreviewStore((s) => s.setCutawayPreset);
  const showVoidView = usePreviewStore((s) => s.showVoidView);
  const setShowVoidView = usePreviewStore((s) => s.setShowVoidView);
  const voidStats = usePreviewStore((s) => s.voidStats);
  const setCutawayLevel = usePreviewStore((s) => s.setCutawayLevel);
  const voxelRootResolution = usePreviewStore((s) => s.voxelRootResolution);
  const voxelDensityStats = usePreviewStore((s) => s.voxelDensityStats);
  const voxelEvalKey = usePreviewStore((s) => s.voxelEvalKey);
  const isVoxelLoading = usePreviewStore((s) => s.isVoxelLoading);
  const voxelPalette = usePreviewStore((s) => s.voxelPalette);
  const hiddenVoxelMaterialNames = usePreviewStore((s) => s.hiddenVoxelMaterialNames);
  const toggleVoxelMaterialVisibility = usePreviewStore((s) => s.toggleVoxelMaterialVisibility);
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
    const rootNodeId = resolvePreviewRootNodeId({
      nodes: editorState.nodes,
      edges: editorState.edges,
      selectedPreviewNodeId: store.selectedPreviewNodeId,
      outputNodeId: editorState.outputNodeId,
    });
    const result = await runFitToContent({
      nodes: editorState.nodes,
      edges: editorState.edges,
      contentFields: editorState.contentFields,
      outputNodeId: editorState.outputNodeId ?? undefined,
      selectedNodeId: rootNodeId,
      useBaseY: store.terrainRefUseBaseY,
      materialConfig: editorState.materialConfig,
    });

    if (result?.hasSolids) {
      const apply = refineFitToContentApply(
        result,
        editorState.nodes,
        editorState.edges,
        editorState.contentFields,
        { useBaseY: store.terrainRefUseBaseY, anchorY: store.yLevel },
      );
      if (apply) {
        store.setRange(apply.rangeMin, apply.rangeMax);
        store.setVoxelYMin(apply.voxelYMin);
        store.setVoxelYMax(apply.voxelYMax);
        if (apply.yLevel != null) store.setYLevel(apply.yLevel);
        store._setUserManualYAdjust(true);
      }
    }

    store.setFitToContentRunning(false);
  }, []);

  const handleResetToAuto = useCallback(() => {
    const store = usePreviewStore.getState();
    store._setUserManualYAdjust(false);
    store._setAutoFitGraphHash("");
    store._setAutoFitContentGraphHash("");
    store.setAutoFitYEnabled(true);
    store.setAutoFitContentEnabled(true);
    store.setSelectedPreviewNodeId(null);
    store.setVoxelMeshData(null);
    usePreviewStore.setState({
      voxelEvalKey: null,
      voxelRootResolution: null,
      voxelDensityStats: null,
      hiddenVoxelMaterialNames: [],
      _voxelSurfaceData: null,
      _voxelFluidConfig: null,
      _voxelVolumeMaterialIds: null,
      _voxelVolumeRes: null,
      _voxelVolumeYSlices: null,
    });
    store.requestManualPreviewRefresh();
  }, []);

  return (
    <PreviewSidebarSection title="Voxel mesh" headingId="preview-voxel-heading">
      <PreviewControlGroup label="Density range">
        <SliderField label="Range min" value={rangeMin} min={-256} max={0} step={1} onChange={(v) => setRange(v, rangeMax)} />
        <SliderField label="Range max" value={rangeMax} min={0} max={256} step={1} onChange={(v) => setRange(rangeMin, v)} />
      </PreviewControlGroup>

      <PreviewControlGroup label="Volume">
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
        <SliderField label="Y slices" value={voxelYSlices} min={8} max={128} step={4} onChange={setVoxelYSlices} />
        {terrainRef && (
          <p className="text-[10px] leading-snug text-tn-text-muted">
            Terrain ref: {terrainRef.baseHeightName} Y={terrainRef.referenceY}
            {!terrainRefUseBaseY && terrainRef.suggestedYLevel !== terrainRef.referenceY
              ? ` · nominal surface Y≈${terrainRef.suggestedYLevel}`
              : terrainRefUseBaseY ? " · anchored to Base Y" : ""}
            {terrainRef.bedrockY != null ? ` · bedrock Y=${terrainRef.bedrockY}` : ""}
          </p>
        )}
      </PreviewControlGroup>

      {/* The two buttons act on the auto-fit settings below them, so they live
          in the same group rather than floating above the sliders. */}
      <PreviewControlGroup label="Framing">
        <PreviewCheckbox checked={autoFitYEnabled} onChange={setAutoFitYEnabled} label="Auto-fit Y range" />
        <PreviewCheckbox
          checked={autoFitContentEnabled}
          onChange={setAutoFitContentEnabled}
          label="Auto fit to content"
          description="Coarse 3D probe when the graph changes — frames XZ and Y to visible solids."
        />
        <PreviewCheckbox
          checked={terrainRefUseBaseY}
          onChange={handleTerrainRefUseBaseY}
          label="Anchor terrain ref to Base Y"
          description="Use ContentFields Base for auto-fit and 2D Y level instead of the height-curve zero-crossing."
        />
        <div className="mt-1 flex gap-1.5">
          <button
            type="button"
            onClick={handleResetToAuto}
            className={`flex-1 ${previewButtonClass}`}
            title="Clears manual overrides so auto-fit can reframe hills"
          >
            Reset to auto
          </button>
          <button
            type="button"
            onClick={handleFitToContent}
            disabled={isFitToContentRunning}
            className={`flex-1 ${previewButtonClass}`}
          >
            {isFitToContentRunning ? "Scanning…" : "Fit to content"}
          </button>
        </div>
      </PreviewControlGroup>

      <PreviewControlGroup label="World seed">
        <input
          type="text"
          value={worldSeed}
          onChange={(e) => setWorldSeed(e.target.value)}
          placeholder="(unseeded)"
          aria-label="World seed"
          className="rounded border border-tn-border bg-tn-surface px-2 py-1 text-xs"
        />
        <p className="text-[10px] text-tn-text-muted leading-snug">
          Root of the seed chain. Set this to your world&rsquo;s seed to preview the
          terrain that world actually generates — every seeded node derives from it.
        </p>
      </PreviewControlGroup>

      <PreviewControlGroup label="Cave visibility">
        <PreviewCheckbox
          checked={cutawayEnabled}
          onChange={setCutawayEnabled}
          label="Cutaway"
          description="Cut the terrain open to see underground. The cut face is filled in as solid rock."
        />
        {cutawayEnabled && (
          <>
            <div className="flex gap-1 mt-1" role="group" aria-label="Cutaway shape">
              {CUTAWAY_SHAPES.map(({ value, label, title }) => (
                <button
                  key={value}
                  type="button"
                  title={title}
                  aria-pressed={cutawayPreset === value}
                  className={`${previewButtonClass} flex-1 ${
                    cutawayPreset === value ? "ring-1 ring-tn-accent" : ""
                  }`}
                  onClick={() => setCutawayPreset(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <SliderField
              label="Cutaway Y"
              value={cutawayLevel}
              min={voxelYMin}
              max={voxelYMax}
              step={1}
              onChange={setCutawayLevel}
            />
          </>
        )}
        <PreviewCheckbox
          checked={showVoidView}
          onChange={setShowVoidView}
          label="Colour by void"
          description="Shade walls by what they enclose: sealed cave, cave mouth, or open surface."
        />
        {showVoidView && voidStats && voidStats.enclosed === 0 && voidStats.breaching === 0 && (
          <PreviewCallout tone="warning">
            No caves in this volume — every surface borders open sky.
          </PreviewCallout>
        )}
        <button
          type="button"
          className={previewButtonClass}
          onClick={() => setCutawayLevel(yLevel)}
        >
          Sync cutaway to 2D Y level ({yLevel})
        </button>
      </PreviewControlGroup>

      <PreviewControlGroup label="Materials">
        <PreviewCheckbox checked={showMaterialColors} onChange={setShowMaterialColors} label="Material colors" />
        <PreviewCheckbox checked={showVoxelWireframe} onChange={setShowVoxelWireframe} label="Wireframe" />
        <PreviewCheckbox checked={showMaterialLegend} onChange={setShowMaterialLegend} label="Material legend" />
        {voxelPalette.length > 0 && (
          <PreviewControlGroup label="Legend visibility" className="border-l border-tn-border/40 pl-2">
            {voxelPalette.map((entry) => {
              const visible = !hiddenVoxelMaterialNames.includes(entry.name);
              return (
                <label
                  key={entry.name}
                  className="flex items-center gap-1.5 text-[10px] text-tn-text-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => toggleVoxelMaterialVisibility(entry.name)}
                    className="rounded border-tn-border bg-tn-bg text-tn-accent focus:ring-tn-accent"
                  />
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm border border-tn-border/60"
                    style={{ backgroundColor: entry.color }}
                    aria-hidden
                  />
                  <span className="truncate font-mono" title={entry.name}>{entry.name}</span>
                </label>
              );
            })}
          </PreviewControlGroup>
        )}
      </PreviewControlGroup>

      <PreviewControlGroup label="Scene">
        <PreviewCheckbox checked={showWaterPlane} onChange={setShowWaterPlane} label="Water plane" />
        <PreviewCheckbox checked={showFog3D} onChange={setShowFog3D} label="Fog" />
        <PreviewCheckbox checked={showSky3D} onChange={setShowSky3D} label="Sky" />
        <PreviewCheckbox checked={showSSAO} onChange={setShowSSAO} label="SSAO" />
        <PreviewCheckbox checked={showEdgeOutline} onChange={setShowEdgeOutline} label="Edge outline" />
      </PreviewControlGroup>

      {voxelRootResolution?.nodeId ? (
        <div className="rounded-md border border-tn-border/60 bg-tn-surface-2/40 px-2.5 py-2 text-[10px] text-tn-text-muted space-y-0.5 font-mono">
          <div className="font-medium text-tn-text-secondary">Voxel eval debug</div>
          <div>Root: {voxelRootResolution.nodeId} ({voxelRootResolution.nodeType ?? "?"})</div>
          <div>Source: {voxelRootResolution.source}</div>
          <div>Terrain output: {voxelRootResolution.connectedToOutput ? "yes" : "no"}</div>
          {voxelDensityStats ? (
            <>
              <div>
                Density: {voxelDensityStats.min.toFixed(2)} to {voxelDensityStats.max.toFixed(2)}
              </div>
              <div>
                Positive samples: {(voxelDensityStats.positiveFraction * 100).toFixed(1)}%
              </div>
            </>
          ) : null}
          <div>Cache: {isVoxelLoading ? "rebuilding" : voxelEvalKey ? "hit" : "empty"}</div>
          {voxelRootResolution.warning ? (
            <PreviewCallout tone="warning">{voxelRootResolution.warning}</PreviewCallout>
          ) : null}
        </div>
      ) : null}
    </PreviewSidebarSection>
  );
}
