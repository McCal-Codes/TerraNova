import { useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewStore, type PropPreviewMode } from "@/stores/previewStore";
import { usePropPlacementStore } from "@/stores/propPlacementStore";
import { PropPlacementCanvasView } from "@/components/properties/PropPlacementCanvasView";
import {
  hasPropPlacementProviders,
  resolvePropPlacementRootNodeId,
  resolvePropPrefabPreviewSource,
} from "@/utils/propEditingContext";
import { useResolvedPropPrefabSource } from "@/hooks/useResolvedPropPrefabSource";
import { PropPrefab3DPreviewView } from "./PropPrefab3DPreviewView";
import { PropPrefabThumbnail } from "./PropPrefabThumbnail";

const TAB_CLASS =
  "px-3 py-1 text-[11px] font-medium rounded-t border border-b-0 transition-colors";
const TAB_ACTIVE = "bg-tn-bg text-tn-text border-tn-border";
const TAB_IDLE = "bg-tn-panel text-tn-text-muted border-transparent hover:text-tn-text";

function PropPreviewTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${TAB_CLASS} ${active ? TAB_ACTIVE : TAB_IDLE}`}
    >
      {label}
    </button>
  );
}

/**
 * Dedicated prop preview strip (split pane below the graph): 2D placement or 3D prefab mesh.
 * Separate from density heatmap / voxel / world preview modes.
 */
export function PropPreviewPanel() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const propPreviewMode = usePreviewStore((s) => s.propPreviewMode);
  const setPropPreviewMode = usePreviewStore((s) => s.setPropPreviewMode);
  const propManualPrefabPath = usePreviewStore((s) => s.propManualPrefabPath);
  const positionCount = usePropPlacementStore((s) => s.positionCount);
  const evaluationError = usePropPlacementStore((s) => s.evaluationError);
  const isEvaluating = usePropPlacementStore((s) => s.isEvaluating);

  const rootNodeId = resolvePropPlacementRootNodeId(nodes, selectedNodeId);
  const graphPrefabSource = resolvePropPrefabPreviewSource(nodes, selectedNodeId);
  const prefabSource = useResolvedPropPrefabSource(nodes, selectedNodeId, propManualPrefabPath);
  const hasPlacementGraph = hasPropPlacementProviders(nodes);
  const showEmptyGraph = nodes.length === 0;
  const showEmptyPlacement =
    !showEmptyGraph && !isEvaluating && !evaluationError && positionCount === 0;

  // Jump to 3D when user selects a prefab node with a path (they can switch back manually).
  useEffect(() => {
    if (!prefabSource) return;
    const selected = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
    if (!selected) return;
    const isSelectedPrefab =
      selected.type === "Prop:Prefab"
      || (selected.data as { type?: string } | undefined)?.type === "Prefab";
    if (isSelectedPrefab && usePreviewStore.getState().propPreviewMode !== "prefab3d") {
      setPropPreviewMode("prefab3d");
    }
  }, [selectedNodeId, prefabSource, nodes, setPropPreviewMode]);

  const setMode = (mode: PropPreviewMode) => setPropPreviewMode(mode);

  return (
    <div className="absolute inset-0 flex flex-col min-h-0 bg-tn-bg">
      <div className="shrink-0 border-b border-tn-border px-3 pt-2 pb-0">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="text-sm font-semibold text-tn-text">Prop preview</h3>
            <p className="text-[11px] text-tn-text-muted mt-0.5">
              Graph nodes stay in the canvas above — use this pane for placement and prefab mesh.
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <PropPreviewTab
            active={propPreviewMode === "placement"}
            label="2D Placement"
            onClick={() => setMode("placement")}
          />
          <PropPreviewTab
            active={propPreviewMode === "prefab3d"}
            label="3D Prefab"
            onClick={() => setMode("prefab3d")}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 p-3 overflow-hidden">
        {propPreviewMode === "placement" ? (
          <div className="flex flex-col h-full min-h-0 gap-2">
            {showEmptyGraph && (
              <p className="text-xs text-tn-text-muted shrink-0">
                This prop layer has no graph nodes yet. Add Positions and Assignments nodes on the
                canvas above, or paste/import prop data from Hytale.
              </p>
            )}
            {showEmptyPlacement && (
              <p className="text-xs text-tn-text-muted shrink-0">
                No placement samples yet — wire a Positions provider or select a Position node.
              </p>
            )}
            <div className="flex-1 min-h-0 flex gap-2">
              <div className="flex-1 min-w-0 min-h-0">
                <PropPlacementCanvasView
                  nodes={nodes}
                  edges={edges}
                  rootNodeId={rootNodeId}
                  title=""
                />
              </div>
              {prefabSource && (
                <div className="w-44 shrink-0 flex flex-col gap-1 min-h-0">
                  <p className="text-[10px] text-tn-text-muted truncate" title={prefabSource.path}>
                    {prefabSource.path}
                  </p>
                  <PropPrefabThumbnail fields={prefabSource.fields} className="flex-1 min-h-[140px]" />
                </div>
              )}
            </div>
          </div>
        ) : (
          <PropPrefab3DPreviewView
            graphSource={graphPrefabSource}
            effectiveSource={prefabSource}
            hasPlacementGraph={hasPlacementGraph}
            onShowPlacement={() => setMode("placement")}
          />
        )}
      </div>
    </div>
  );
}
