import { usePreviewStore } from "@/stores/previewStore";
import { COLORMAPS } from "@/utils/colormaps";
import { PreviewCheckbox, PreviewField, previewSelectClass } from "./PreviewControlPrimitives";

/** Shared compare settings — colormap, resolution, linked 3D cameras. */
export function ComparisonControls() {
  const colormap = usePreviewStore((s) => s.colormap);
  const setColormap = usePreviewStore((s) => s.setColormap);
  const resolution = usePreviewStore((s) => s.resolution);
  const setResolution = usePreviewStore((s) => s.setResolution);
  const linkCameras3D = usePreviewStore((s) => s.linkCameras3D);
  const setLinkCameras3D = usePreviewStore((s) => s.setLinkCameras3D);

  return (
    <div className="flex flex-col gap-2.5 p-3" role="region" aria-label="Compare settings">
      <PreviewField label="Colormap" htmlFor="compare-colormap">
        <select
          id="compare-colormap"
          value={colormap}
          onChange={(e) => setColormap(e.target.value as typeof colormap)}
          className={previewSelectClass}
        >
          {COLORMAPS.map((cm) => (
            <option key={cm.id} value={cm.id}>
              {cm.label}
            </option>
          ))}
        </select>
      </PreviewField>

      <PreviewField label="Resolution" htmlFor="compare-resolution">
        <input
          id="compare-resolution"
          type="number"
          value={resolution}
          min={16}
          max={512}
          step={16}
          onChange={(e) => setResolution(parseInt(e.target.value, 10) || 128)}
          className={previewSelectClass}
        />
      </PreviewField>

      <PreviewCheckbox
        checked={linkCameras3D}
        onChange={setLinkCameras3D}
        label="Link 3D cameras"
        description="Keep both panes on the same orbit when comparing 3D heightfields."
      />
    </div>
  );
}
