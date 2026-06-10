import { usePreviewStore } from "@/stores/previewStore";
import { previewChip } from "./controls/PreviewControlPrimitives";

/** Compact toggles for the preview toolbar — full controls live in the settings sidebar. */
export function PreviewQuickToggles2D() {
  const usgsTopoStyle = usePreviewStore((s) => s.usgsTopoStyle);
  const setUsgsTopoStyle = usePreviewStore((s) => s.setUsgsTopoStyle);
  const showThresholdView = usePreviewStore((s) => s.showThresholdView);
  const setShowThresholdView = usePreviewStore((s) => s.setShowThresholdView);
  const showContours = usePreviewStore((s) => s.showContours);
  const setShowContours = usePreviewStore((s) => s.setShowContours);
  const showHillShade = usePreviewStore((s) => s.showHillShade);
  const setShowHillShade = usePreviewStore((s) => s.setShowHillShade);

  return (
    <div className="flex items-center gap-1 shrink-0" role="group" aria-label="2D display toggles">
      <button
        type="button"
        aria-pressed={usgsTopoStyle}
        title="USGS topo style — parchment base with brown contours"
        onClick={() => setUsgsTopoStyle(!usgsTopoStyle)}
        className={previewChip(usgsTopoStyle)}
      >
        Topo
      </button>
      <button
        type="button"
        aria-pressed={showHillShade}
        title="Hill shade relief"
        onClick={() => setShowHillShade(!showHillShade)}
        className={previewChip(showHillShade)}
      >
        Shade
      </button>
      <button
        type="button"
        aria-pressed={showThresholdView}
        title="Terrain view — density = 0 surface"
        onClick={() => setShowThresholdView(!showThresholdView)}
        className={previewChip(showThresholdView)}
      >
        Terrain
      </button>
      <button
        type="button"
        aria-pressed={showContours}
        title="Density contour lines"
        onClick={() => setShowContours(!showContours)}
        className={previewChip(showContours)}
      >
        Contours
      </button>
    </div>
  );
}
