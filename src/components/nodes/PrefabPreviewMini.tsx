import { memo } from "react";
import type { Node } from "@xyflow/react";
import { useProjectStore } from "@/stores/projectStore";
import { usePrefabPreview } from "@/hooks/usePrefabPreview";
import { PrefabPreview3D } from "@/components/preview/PrefabPreview3D";

interface PrefabPreviewMiniProps {
  fields: Record<string, unknown>;
}

/** Inline graph thumbnail for Prop:Prefab nodes when inline previews are enabled. */
export const PrefabPreviewMini = memo(function PrefabPreviewMini({ fields }: PrefabPreviewMiniProps) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const preview = usePrefabPreview(fields, projectPath, 600);

  if (preview.loading) {
    return (
      <div className="w-full max-w-[200px] mx-auto aspect-[5/3] rounded border border-tn-border/60 bg-[#1c1a17] flex items-center justify-center text-[9px] text-tn-text-muted">
        …
      </div>
    );
  }

  if (preview.error || !preview.mesh) {
    return (
      <div className="w-full max-w-[200px] mx-auto aspect-[5/3] rounded border border-tn-border/60 bg-[#1c1a17] flex items-center justify-center text-[9px] text-tn-text-muted px-1 text-center">
        {preview.error ? "Prefab n/a" : "Prefab"}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[200px] mx-auto aspect-[5/3] rounded border border-tn-border/60 overflow-hidden pointer-events-none relative bg-[#1c1a17]">
      <PrefabPreview3D mesh={preview.mesh} compact className="absolute inset-0 w-full h-full" />
    </div>
  );
});

export function isPrefabPropNode(node: Node | null | undefined): boolean {
  if (!node) return false;
  if (node.type === "Prop:Prefab") return true;
  const data = node.data as { type?: string } | undefined;
  return data?.type === "Prefab";
}
