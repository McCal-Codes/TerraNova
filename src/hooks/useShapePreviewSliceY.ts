import { usePreviewStore } from "@/stores/previewStore";

/** World Y used for shape-preview slice evaluation and 3D overlays. */
export function useShapePreviewSliceY(): number {
  const mode = usePreviewStore((s) => s.mode);
  const yLevel = usePreviewStore((s) => s.yLevel);
  const voxelYMin = usePreviewStore((s) => s.voxelYMin);
  const voxelYMax = usePreviewStore((s) => s.voxelYMax);

  return getShapePreviewSliceY(mode, yLevel, voxelYMin, voxelYMax, {
    preferYLevel: mode === "voxel" || mode === "world",
  });
}

export function getShapePreviewSliceY(
  mode: string,
  yLevel: number,
  voxelYMin: number,
  voxelYMax: number,
  options?: { preferYLevel?: boolean },
): number {
  if (mode === "voxel" || mode === "world") {
    if (options?.preferYLevel) {
      return Math.max(voxelYMin, Math.min(voxelYMax, Math.round(yLevel)));
    }
    return Math.round((voxelYMin + voxelYMax) / 2);
  }
  return yLevel;
}
