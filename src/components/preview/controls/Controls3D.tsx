import { usePreviewStore } from "@/stores/previewStore";
import { SliderField } from "@/components/properties/SliderField";
import { PreviewCheckbox, PreviewSidebarSection } from "./PreviewControlPrimitives";

export function Controls3D() {
  const resolution = usePreviewStore((s) => s.resolution);
  const setResolution = usePreviewStore((s) => s.setResolution);
  const rangeMin = usePreviewStore((s) => s.rangeMin);
  const rangeMax = usePreviewStore((s) => s.rangeMax);
  const setRange = usePreviewStore((s) => s.setRange);
  const yLevel = usePreviewStore((s) => s.yLevel);
  const setYLevel = usePreviewStore((s) => s.setYLevel);
  const heightScale3D = usePreviewStore((s) => s.heightScale3D);
  const setHeightScale3D = usePreviewStore((s) => s.setHeightScale3D);
  const showWaterPlane = usePreviewStore((s) => s.showWaterPlane);
  const setShowWaterPlane = usePreviewStore((s) => s.setShowWaterPlane);
  const waterPlaneLevel = usePreviewStore((s) => s.waterPlaneLevel);
  const setWaterPlaneLevel = usePreviewStore((s) => s.setWaterPlaneLevel);
  const showFog3D = usePreviewStore((s) => s.showFog3D);
  const setShowFog3D = usePreviewStore((s) => s.setShowFog3D);
  const showSky3D = usePreviewStore((s) => s.showSky3D);
  const setShowSky3D = usePreviewStore((s) => s.setShowSky3D);
  const showSSAO = usePreviewStore((s) => s.showSSAO);
  const setShowSSAO = usePreviewStore((s) => s.setShowSSAO);
  const showEdgeOutline = usePreviewStore((s) => s.showEdgeOutline);
  const setShowEdgeOutline = usePreviewStore((s) => s.setShowEdgeOutline);
  const show3DVolumeView = usePreviewStore((s) => s.show3DVolumeView);
  const setShow3DVolumeView = usePreviewStore((s) => s.setShow3DVolumeView);
  const cutawayEnabled = usePreviewStore((s) => s.cutawayEnabled);
  const setCutawayEnabled = usePreviewStore((s) => s.setCutawayEnabled);
  const cutawayLevel = usePreviewStore((s) => s.cutawayLevel);
  const setCutawayLevel = usePreviewStore((s) => s.setCutawayLevel);
  const voxelYMin = usePreviewStore((s) => s.voxelYMin);
  const voxelYMax = usePreviewStore((s) => s.voxelYMax);

  return (
    <PreviewSidebarSection title={show3DVolumeView ? "3D underground volume" : "3D heightfield"} headingId="preview-3d-heading">
      <PreviewCheckbox
        checked={show3DVolumeView}
        onChange={setShow3DVolumeView}
        label="Underground view (volume mesh)"
        description="Surface heightfield cannot show caves; use volume mesh or Voxel mode."
      />
      {show3DVolumeView && (
        <>
          <PreviewCheckbox
            checked={cutawayEnabled}
            onChange={setCutawayEnabled}
            label="Cutaway (hide above Y)"
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
        </>
      )}
      {!show3DVolumeView && (
        <SliderField label="Resolution" value={resolution} min={16} max={512} step={16} onChange={setResolution} />
      )}
      <SliderField label="Range min" value={rangeMin} min={-256} max={0} step={1} onChange={(v) => setRange(v, rangeMax)} />
      <SliderField label="Range max" value={rangeMax} min={0} max={256} step={1} onChange={(v) => setRange(rangeMin, v)} />
      <SliderField label="Y level (slice)" value={yLevel} min={0} max={256} step={1} onChange={setYLevel} />
      <SliderField label="Height scale" value={heightScale3D} min={1} max={50} step={0.5} onChange={setHeightScale3D} />

      <fieldset className="flex flex-col gap-0.5 border-0 p-0 m-0 min-w-0">
        <legend className="text-[10px] font-medium text-tn-text-muted mb-1 px-0">Scene</legend>
        <PreviewCheckbox checked={showWaterPlane} onChange={setShowWaterPlane} label="Water plane" />
        {showWaterPlane && (
          <SliderField
            label="Water level"
            value={waterPlaneLevel}
            min={0}
            max={1}
            step={0.01}
            onChange={setWaterPlaneLevel}
          />
        )}
        <PreviewCheckbox checked={showFog3D} onChange={setShowFog3D} label="Fog" />
        <PreviewCheckbox checked={showSky3D} onChange={setShowSky3D} label="Sky" />
        <PreviewCheckbox checked={showSSAO} onChange={setShowSSAO} label="SSAO" />
        <PreviewCheckbox checked={showEdgeOutline} onChange={setShowEdgeOutline} label="Edge outline" />
      </fieldset>
    </PreviewSidebarSection>
  );
}
