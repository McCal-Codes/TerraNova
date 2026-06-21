import { Suspense, lazy } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { usePrefabPreview } from "@/hooks/usePrefabPreview";
import { PREFAB_PREVIEW_RENDER_CAP } from "@/utils/hytaleBlockAssets/buildPrefabPreviewMesh";

const PrefabPreview3D = lazy(() =>
  import("./PrefabPreview3D").then((m) => ({ default: m.PrefabPreview3D })),
);

interface PropPrefabThumbnailProps {
  fields: Record<string, unknown>;
  className?: string;
}

/** Compact textured prefab thumbnail for placement mode side panel. */
export function PropPrefabThumbnail({ fields, className }: PropPrefabThumbnailProps) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const preview = usePrefabPreview(fields, projectPath, { renderCap: PREFAB_PREVIEW_RENDER_CAP });

  return (
    <div className={className ?? "relative h-full min-h-[120px] rounded border border-tn-border overflow-hidden bg-[#1c1a17]"}>
      {preview.loading && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-tn-text-muted">
          Loading…
        </div>
      )}
      {!preview.loading && preview.error && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-amber-400/90 px-2 text-center">
          {preview.error}
        </div>
      )}
      {!preview.loading && preview.mesh && (
        <Suspense fallback={null}>
          <PrefabPreview3D mesh={preview.mesh} compact className="absolute inset-0 w-full h-full" />
        </Suspense>
      )}
    </div>
  );
}
