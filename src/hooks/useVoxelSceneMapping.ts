import { usePreviewStore } from "@/stores/previewStore";
import type { VoxelSceneMapping } from "@/utils/shapePreview/previewSceneCoords";

/** Voxel mesh ↔ shape-overlay coordinate mapping (matches useVoxelEvaluation). */
export function useVoxelSceneMapping(): VoxelSceneMapping {
  const rangeMin = usePreviewStore((s) => s.rangeMin);
  const rangeMax = usePreviewStore((s) => s.rangeMax);
  const voxelYMin = usePreviewStore((s) => s.voxelYMin);
  const voxelYMax = usePreviewStore((s) => s.voxelYMax);
  const resolution = usePreviewStore((s) => s.voxelResolution);
  const ySlices = usePreviewStore((s) => s.voxelYSlices);

  return {
    rangeMin,
    rangeMax,
    voxelYMin,
    voxelYMax,
    resolution,
    ySlices,
  };
}
