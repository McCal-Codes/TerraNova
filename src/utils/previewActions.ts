import { usePreviewStore } from "@/stores/previewStore";

/** Open the prop preview panel on the 3D prefab tab for a path. */
export function openPrefab3DPreview(path: string): void {
  const preview = usePreviewStore.getState();
  preview.setPropManualPrefabPath(path);
  preview.setPropPreviewMode("prefab3d");
}
