import { usePreviewStore } from "@/stores/previewStore";
import { useEditorStore } from "@/stores/editorStore";
import { SliderField } from "@/components/properties/SliderField";
import {
  PreviewCheckbox,
  PreviewField,
  PreviewSidebarSection,
  previewSelectClass,
} from "./PreviewControlPrimitives";

export function PositionOverlayControls() {
  const showPositionOverlay = usePreviewStore((s) => s.showPositionOverlay);
  const setShowPositionOverlay = usePreviewStore((s) => s.setShowPositionOverlay);
  const positionOverlayNodeId = usePreviewStore((s) => s.positionOverlayNodeId);
  const setPositionOverlayNodeId = usePreviewStore((s) => s.setPositionOverlayNodeId);
  const positionOverlayPoints = usePreviewStore((s) => s.positionOverlayPoints);
  const positionOverlaySize = usePreviewStore((s) => s.positionOverlaySize);
  const setPositionOverlaySize = usePreviewStore((s) => s.setPositionOverlaySize);
  const positionOverlaySeed = usePreviewStore((s) => s.positionOverlaySeed);
  const setPositionOverlaySeed = usePreviewStore((s) => s.setPositionOverlaySeed);

  const nodes = useEditorStore((s) => s.nodes);
  const positionNodes = nodes.filter((n) => (n.type ?? "").startsWith("Position:"));

  return (
    <PreviewSidebarSection title="Position overlay" headingId="preview-position-heading">
      <PreviewCheckbox
        checked={showPositionOverlay}
        onChange={setShowPositionOverlay}
        label="Show position samples"
        description="Scatter plot on the 2D heatmap"
      />

      {showPositionOverlay && (
        <>
          <PreviewField label="Source node" htmlFor="position-overlay-source">
            <select
              id="position-overlay-source"
              value={positionOverlayNodeId ?? "__auto__"}
              onChange={(e) => {
                const val = e.target.value;
                setPositionOverlayNodeId(val === "__auto__" ? null : val);
              }}
              className={previewSelectClass}
            >
              <option value="__auto__">Auto-detect</option>
              {positionNodes.map((n) => {
                const data = n.data as Record<string, unknown>;
                const typeName = (data?.type as string) ?? n.type ?? "Node";
                return (
                  <option key={n.id} value={n.id}>
                    {typeName} ({n.id})
                  </option>
                );
              })}
            </select>
          </PreviewField>

          <SliderField
            label="Seed"
            value={positionOverlaySeed}
            min={0}
            max={999}
            step={1}
            onChange={setPositionOverlaySeed}
          />
          <SliderField
            label="Dot size"
            value={positionOverlaySize}
            min={0.5}
            max={5}
            step={0.5}
            onChange={setPositionOverlaySize}
          />

          {positionOverlayPoints.length > 0 && (
            <p className="text-[10px] text-tn-text-muted tabular-nums">
              {positionOverlayPoints.length.toLocaleString()} positions in range
            </p>
          )}
        </>
      )}
    </PreviewSidebarSection>
  );
}
