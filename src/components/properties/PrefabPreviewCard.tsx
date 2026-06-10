import { useProjectStore } from "@/stores/projectStore";
import { usePrefabPreview } from "@/hooks/usePrefabPreview";
import { PrefabPreview3D } from "@/components/preview/PrefabPreview3D";
import { extractPrefabPathFromFields } from "@/utils/hytaleBlockAssets/extractPrefabPath";

interface PrefabPreviewCardProps {
  fields: Record<string, unknown>;
}

/** Property-panel 3D preview for Prop:Prefab Path / WeightedPrefabPaths. */
export function PrefabPreviewCard({ fields }: PrefabPreviewCardProps) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const relativePath = extractPrefabPathFromFields(fields);
  const preview = usePrefabPreview(fields, projectPath);

  if (!relativePath) {
    return (
      <div className="border-t border-tn-border pt-2 mt-1">
        <p className="text-[11px] text-tn-text-muted">
          Set a prefab Path to preview the structure here.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-tn-border pt-2 mt-1 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-tn-text">Prefab preview</span>
        {preview.mesh && (
          <span className="text-[10px] text-tn-text-muted">
            {preview.mesh.blockCount.toLocaleString()} blocks
            {preview.entityCount > 0 ? ` · ${preview.entityCount} entities` : ""}
            {preview.mesh.truncated ? " · capped" : ""}
          </span>
        )}
      </div>

      <p className="text-[10px] text-tn-text-muted truncate" title={relativePath}>
        {relativePath}
      </p>

      {preview.loading && (
        <div className="h-[220px] flex items-center justify-center text-[11px] text-tn-text-muted">
          Loading prefab…
        </div>
      )}

      {!preview.loading && preview.error && (
        <div className="h-[120px] flex items-center justify-center text-[11px] text-amber-400/90 px-2 text-center">
          {preview.error}
        </div>
      )}

      {!preview.loading && !preview.error && preview.mesh && (
        <PrefabPreview3D mesh={preview.mesh} className="h-[280px] w-full" />
      )}

      {preview.resolvedPath && (
        <p className="text-[9px] text-tn-text-muted/70 truncate" title={preview.resolvedPath}>
          Resolved: {preview.resolvedPath.split(/[/\\]/).slice(-3).join("/")}
        </p>
      )}
    </div>
  );
}
