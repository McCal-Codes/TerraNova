import { usePreviewStore } from "@/stores/previewStore";
import { MAX_2D_PREVIEW_RES } from "@/utils/previewResolution";
import { SliderField } from "@/components/properties/SliderField";
import {
  PreviewCheckbox,
  PreviewSidebarSection,
  previewButtonClass,
} from "./PreviewControlPrimitives";
export function Controls2D() {
  const resolution = usePreviewStore((s) => s.resolution);
  const setResolution = usePreviewStore((s) => s.setResolution);
  const rangeMin = usePreviewStore((s) => s.rangeMin);
  const rangeMax = usePreviewStore((s) => s.rangeMax);
  const setRange = usePreviewStore((s) => s.setRange);
  const yLevel = usePreviewStore((s) => s.yLevel);
  const setYLevel = usePreviewStore((s) => s.setYLevel);
  const showContours = usePreviewStore((s) => s.showContours);
  const setShowContours = usePreviewStore((s) => s.setShowContours);
  const contourInterval = usePreviewStore((s) => s.contourInterval);
  const setContourInterval = usePreviewStore((s) => s.setContourInterval);
  const resetCanvasTransform = usePreviewStore((s) => s.resetCanvasTransform);
  const showHillShade = usePreviewStore((s) => s.showHillShade);
  const setShowHillShade = usePreviewStore((s) => s.setShowHillShade);
  const usgsTopoStyle = usePreviewStore((s) => s.usgsTopoStyle);
  const setUsgsTopoStyle = usePreviewStore((s) => s.setUsgsTopoStyle);
  const showThresholdView = usePreviewStore((s) => s.showThresholdView);
  const setShowThresholdView = usePreviewStore((s) => s.setShowThresholdView);
  const showCrossSection = usePreviewStore((s) => s.showCrossSection);
  const setShowCrossSection = usePreviewStore((s) => s.setShowCrossSection);
  const crossSectionProfileMode = usePreviewStore((s) => s.crossSectionProfileMode);
  const setCrossSectionProfileMode = usePreviewStore((s) => s.setCrossSectionProfileMode);
  const showStatistics = usePreviewStore((s) => s.showStatistics);
  const setShowStatistics = usePreviewStore((s) => s.setShowStatistics);
  const statisticsLogScale = usePreviewStore((s) => s.statisticsLogScale);
  const setStatisticsLogScale = usePreviewStore((s) => s.setStatisticsLogScale);

  return (
    <PreviewSidebarSection title="2D map view" headingId="preview-2d-heading">
      <SliderField
        label="Base resolution"
        value={Math.min(resolution, MAX_2D_PREVIEW_RES)}
        min={16}
        max={MAX_2D_PREVIEW_RES}
        step={16}
        onChange={setResolution}
      />
      <p className="text-[9px] text-tn-text-muted -mt-1 mb-1 leading-snug">
        Scroll zoom raises eval resolution up to 256² when zoomed in; zoom out uses fewer samples.
      </p>
      <SliderField label="Range min" value={rangeMin} min={-256} max={0} step={1} onChange={(v) => setRange(v, rangeMax)} />
      <SliderField label="Range max" value={rangeMax} min={0} max={256} step={1} onChange={(v) => setRange(rangeMin, v)} />
      <SliderField label="Y level (slice)" value={yLevel} min={0} max={256} step={1} onChange={setYLevel} />

      <fieldset className="flex flex-col gap-0.5 border-0 p-0 m-0 min-w-0">
        <legend className="text-[10px] font-medium text-tn-text-muted mb-1 px-0">Display</legend>
        <PreviewCheckbox
          checked={usgsTopoStyle}
          onChange={setUsgsTopoStyle}
          label="USGS topo style"
          description="Hypsometric tint, woodland/water washes, brown index contours."
        />
        <PreviewCheckbox
          checked={showHillShade}
          onChange={setShowHillShade}
          label="Hill shade"
          description="NW sun relief shading on the density field."
        />
        <PreviewCheckbox
          checked={showThresholdView}
          onChange={setShowThresholdView}
          label="Terrain view"
          description="Emphasize the density = 0 surface boundary."
        />
        <PreviewCheckbox
          checked={showContours}
          onChange={setShowContours}
          label="Density contours"
          description="Iso-lines of equal density; dashed blue below zero."
        />
        {showContours && (
          <SliderField
            label="Contour interval"
            value={contourInterval}
            min={0.05}
            max={2}
            step={0.05}
            onChange={setContourInterval}
          />
        )}
        <PreviewCheckbox checked={showStatistics} onChange={setShowStatistics} label="Statistics panel" />
        {showStatistics && (
          <div className="pl-2">
            <PreviewCheckbox
              checked={statisticsLogScale}
              onChange={setStatisticsLogScale}
              label="Log scale histogram"
            />
          </div>
        )}
        <PreviewCheckbox
          checked={showCrossSection}
          onChange={setShowCrossSection}
          label="Cross-section plot"
          description="Shift+drag on map to draw a profile line."
        />
        {showCrossSection && (
          <div className="pl-2 flex flex-col gap-0.5">
            <label className="flex items-center gap-1.5 text-[10px] text-tn-text cursor-pointer">
              <input
                type="radio"
                name="crossSectionProfileMode"
                checked={crossSectionProfileMode === "plan"}
                onChange={() => setCrossSectionProfileMode("plan")}
              />
              Plan profile (fixed Y slice)
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-tn-text cursor-pointer">
              <input
                type="radio"
                name="crossSectionProfileMode"
                checked={crossSectionProfileMode === "section"}
                onChange={() => setCrossSectionProfileMode("section")}
              />
              Section profile (vertical wall through caves)
            </label>
          </div>
        )}
      </fieldset>

      <button type="button" onClick={resetCanvasTransform} className={previewButtonClass}>
        Reset pan / zoom
      </button>
    </PreviewSidebarSection>
  );
}
