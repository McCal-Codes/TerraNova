import { Suspense, lazy } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useUIStore } from "@/stores/uiStore";
import { usePrefabPreview } from "@/hooks/usePrefabPreview";
import { PREFAB_PREVIEW_BLOCK_CAP } from "@/utils/hytaleBlockAssets/buildPrefabPreviewMesh";
import type { PropPrefabPreviewSource } from "@/utils/propEditingContext";
import { PrefabPathBrowser } from "./PrefabPathBrowser";

const PrefabPreview3D = lazy(() =>
  import("./PrefabPreview3D").then((m) => ({ default: m.PrefabPreview3D })),
);

function Preview3DFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px] text-sm text-tn-text-muted">
      Loading 3D prefab…
    </div>
  );
}

interface PropPrefab3DPreviewViewProps {
  graphSource: PropPrefabPreviewSource | null;
  effectiveSource: PropPrefabPreviewSource | null;
  hasPlacementGraph?: boolean;
  onShowPlacement?: () => void;
}

/** Full-size 3D prefab preview with path browser (Hytale Creative Tools style). */
export function PropPrefab3DPreviewView({
  graphSource,
  effectiveSource,
  hasPlacementGraph = false,
  onShowPlacement,
}: PropPrefab3DPreviewViewProps) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const setPropManualPrefabPath = usePreviewStore((s) => s.setPropManualPrefabPath);
  const setRequestedSettingsTab = useUIStore((s) => s.setRequestedSettingsTab);
  const preview = usePrefabPreview(effectiveSource?.fields ?? {}, projectPath, {
    renderCap: PREFAB_PREVIEW_BLOCK_CAP,
  });

  const handleBrowseSelect = (path: string) => {
    if (graphSource?.path === path) {
      setPropManualPrefabPath(null);
      return;
    }
    setPropManualPrefabPath(path);
  };

  return (
    <div className="flex h-full min-h-0 gap-2">
      <PrefabPathBrowser
        projectPath={projectPath}
        selectedPath={effectiveSource?.path ?? null}
        graphPath={graphSource?.path ?? null}
        onSelectPath={handleBrowseSelect}
      />

      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {!effectiveSource ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] px-4 text-center gap-3">
            <p className="text-sm text-tn-text-muted">
              Pick a prefab from the list, or add Prop:Prefab with Path to the graph.
            </p>
            <p className="text-[11px] text-tn-text-muted/80 max-w-sm">
              {hasPlacementGraph
                ? "This layer has Positions nodes — use 2D Placement for scatter preview. Prop:Imported references another prop file, not a mesh path."
                : "Wire Positions for 2D placement, or browse synced Hytale prefabs for 3D mesh preview."}
            </p>
            {hasPlacementGraph && onShowPlacement && (
              <button
                type="button"
                onClick={onShowPlacement}
                className="px-3 py-1.5 text-xs font-medium rounded border border-tn-accent/40 bg-tn-accent/10 text-tn-accent hover:bg-tn-accent/20 transition-colors"
              >
                Show 2D Placement
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="shrink-0 px-1 pb-2">
              <p className="text-[11px] text-tn-text-muted truncate" title={effectiveSource.path}>
                {graphSource?.path === effectiveSource.path ? "Graph" : "Preview"}:{" "}
                {effectiveSource.path}
              </p>
              {preview.mesh && (
                <div className="text-[10px] text-tn-text-muted/80">
                  <p>
                    {preview.mesh.blockCount.toLocaleString()} blocks
                    {preview.entityCount > 0 ? ` · ${preview.entityCount} entities` : ""}
                    {preview.mesh.truncated ? " · capped for preview" : ""}
                    {preview.totalBlockTypes > 0 && (
                      <>
                        {" · "}
                        {preview.texturedBlockTypes > 0
                          ? `${preview.texturedBlockTypes}/${preview.totalBlockTypes} block types textured`
                          : "sync Hytale assets for block textures"}
                      </>
                    )}
                  </p>
                  {preview.totalBlockTypes > 0 && preview.texturedBlockTypes === 0 && (
                    <button
                      type="button"
                      onClick={() => setRequestedSettingsTab("assets")}
                      className="mt-1 text-[10px] font-medium text-tn-accent hover:text-tn-accent/80"
                    >
                      Sync Hytale assets…
                    </button>
                  )}
                </div>
              )}
            </div>

            {preview.loading && (
              <div className="flex-1 flex items-center justify-center text-xs text-tn-text-muted">
                Loading prefab…
              </div>
            )}

            {!preview.loading && preview.error && (
              <div className="flex-1 flex items-center justify-center text-xs text-amber-400/90 px-3 text-center">
                {preview.error}
              </div>
            )}

            {!preview.loading && !preview.error && preview.mesh && (
              <div className="flex-1 min-h-0">
                <Suspense fallback={<Preview3DFallback />}>
                  <PrefabPreview3D mesh={preview.mesh} className="h-full w-full min-h-[220px]" />
                </Suspense>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
