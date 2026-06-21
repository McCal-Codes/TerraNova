import type { Node } from "@xyflow/react";
import { usePreviewStore } from "@/stores/previewStore";
import { useToastStore } from "@/stores/toastStore";
import type { SnippetDefinition } from "@/schema/snippets";
import {
  DENSITY_BASICS_CASE_META,
  isDensityBasicsCaseId,
} from "@/utils/densityBasics/caseMeta";
import { applyAutoVoxelPreviewIfNeeded } from "@/utils/densityPreviewRouting";

function snippetMeta(node: Node): Record<string, unknown> | null {
  const data = node.data as Record<string, unknown> | undefined;
  const meta = data?._snippetMeta;
  return meta && typeof meta === "object" ? (meta as Record<string, unknown>) : null;
}

/** After placing a Density basics snippet: set preview target and optional voxel mode. */
export function afterPlaceDensityBasicsSnippet(
  snippet: SnippetDefinition,
  placedNodes: Node[],
): void {
  if (!isDensityBasicsCaseId(snippet.id)) return;

  const meta = DENSITY_BASICS_CASE_META[snippet.id];
  const previewNode = placedNodes.find((n) => {
    const m = snippetMeta(n);
    return m?.localId === meta.previewLocalId;
  });
  if (!previewNode) return;

  const preview = usePreviewStore.getState();
  preview.setSelectedPreviewNodeId(previewNode.id);

  if (meta.defaultPreviewMode === "voxel") {
    applyAutoVoxelPreviewIfNeeded({
      reason: "3D density field — switched to Voxel for volumetric preview.",
      force: true,
    });
  }

  useToastStore.getState().addToast(
    `Preview target set to ${meta.name}. Use Preview settings to change target or mode.`,
    "info",
  );
}
