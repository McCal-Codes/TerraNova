import { usePreviewStore } from "@/stores/previewStore";
import { useEditorStore } from "@/stores/editorStore";
import { triggerManualEvaluation } from "@/hooks/usePreviewEvaluation";
import { DENSITY_TYPES, getNodeType } from "@/utils/density/evalTypes";
import { supportsShapePreviewCard } from "@/utils/shapePreview/shapePreviewProfile";
import { useResolvePreviewRoot } from "@/hooks/useResolvePreviewRoot";
import { COLORMAPS } from "@/utils/colormaps";
import {
  PreviewCallout,
  PreviewCheckbox,
  PreviewField,
  previewButtonClass,
  previewSelectClass,
} from "./PreviewControlPrimitives";

interface SharedControlsProps {
  canExport?: boolean;
  onExport?: () => void | Promise<void>;
}

export function SharedControls({ canExport = false, onExport }: SharedControlsProps) {
  const mode = usePreviewStore((s) => s.mode);
  const autoRefresh = usePreviewStore((s) => s.autoRefresh);
  const setAutoRefresh = usePreviewStore((s) => s.setAutoRefresh);
  const isLoading = usePreviewStore((s) => s.isLoading);
  const previewError = usePreviewStore((s) => s.previewError);
  const worldError = usePreviewStore((s) => s.worldError);
  const colormap = usePreviewStore((s) => s.colormap);
  const setColormap = usePreviewStore((s) => s.setColormap);
  const selectedPreviewNodeId = usePreviewStore((s) => s.selectedPreviewNodeId);
  const setSelectedPreviewNodeId = usePreviewStore((s) => s.setSelectedPreviewNodeId);
  const setShowShapePreview = usePreviewStore((s) => s.setShowShapePreview);

  const nodes = useEditorStore((s) => s.nodes);
  const outputNodeId = useEditorStore((s) => s.outputNodeId);
  const rootResolution = useResolvePreviewRoot();

  const densityNodes = nodes.filter((n) => DENSITY_TYPES.has(getNodeType(n)));

  const errorMessage = previewError || worldError;

  const handlePreviewTargetChange = (nodeId: string | null) => {
    setSelectedPreviewNodeId(nodeId);
    if (!nodeId) return;
    const node = nodes.find((n) => n.id === nodeId);
    if (node && supportsShapePreviewCard(getNodeType(node))) {
      setShowShapePreview(true);
    }
  };

  return (
    <>
      {errorMessage ? <PreviewCallout tone="error">{errorMessage}</PreviewCallout> : null}

      {mode !== "world" && (
        <div className="flex items-center gap-2 flex-wrap">
          <PreviewCheckbox
            checked={autoRefresh}
            onChange={setAutoRefresh}
            label="Auto-refresh"
          />
          <button
            type="button"
            onClick={triggerManualEvaluation}
            disabled={isLoading}
            className={previewButtonClass}
          >
            Evaluate now
          </button>
        </div>
      )}

      {mode !== "voxel" && mode !== "world" && (
        <PreviewField label="Colormap" htmlFor="preview-colormap">
          <select
            id="preview-colormap"
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
      )}

      {rootResolution.warning && mode !== "world" ? (
        <PreviewCallout tone="warning">{rootResolution.warning}</PreviewCallout>
      ) : null}

      {mode !== "world" && (
        <PreviewField label="Preview target" htmlFor="preview-target">
          <select
            id="preview-target"
            value={selectedPreviewNodeId ?? "__auto__"}
            onChange={(e) => {
              const val = e.target.value;
              handlePreviewTargetChange(val === "__auto__" ? null : val);
            }}
            className={previewSelectClass}
          >
            <option value="__auto__">
              {outputNodeId ? "Auto (designated output)" : "Auto (terminal node)"}
            </option>
            {densityNodes.map((n) => {
              const typeName = getNodeType(n);
              const isOutput = n.id === outputNodeId;
              const isRecommended = n.id === rootResolution.recommendedNodeId;
              return (
                <option key={n.id} value={n.id}>
                  {isOutput ? "\u2605 " : ""}
                  {isRecommended && !isOutput ? "\u25C6 " : ""}
                  {typeName} ({n.id})
                </option>
              );
            })}
          </select>
        </PreviewField>
      )}

      <button
        type="button"
        onClick={() => void onExport?.()}
        disabled={!canExport}
        className={previewButtonClass}
        title={canExport ? "Export preview as PNG (Alt+S)" : "Open a preview first"}
      >
        Export PNG
      </button>
    </>
  );
}
