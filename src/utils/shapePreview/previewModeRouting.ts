import { getShapePreviewProfile, isCellNoiseType, isSdfType } from "./shapePreviewProfile";
import type { PreviewMode } from "@/stores/previewStore";

export type ShapePreviewModeHint = {
  recommended: PreviewMode;
  reason: string;
};

/** Suggest the preview mode that matches how each node type is best inspected. */
export function getShapePreviewModeHint(nodeType: string | null): ShapePreviewModeHint | null {
  if (!nodeType) return null;

  if (isSdfType(nodeType)) {
    return {
      recommended: "2d",
      reason: "SDF shapes are clearest on a 2D density slice; use Voxel for full solid mesh.",
    };
  }

  const profile = getShapePreviewProfile(nodeType);
  if (profile.cells || profile.mesh) {
    return {
      recommended: "2d",
      reason: "Cell walls and mesh samples are XZ layouts — use the cell map in 2D, not Voxel overlays.",
    };
  }

  if (isCellNoiseType(nodeType)) {
    return { recommended: "2d", reason: "Cell noise is a horizontal slice field — use 2D + cell map." };
  }

  return null;
}

export function shouldShowShapeCellMap(nodeType: string | null): boolean {
  if (!nodeType) return false;
  const p = getShapePreviewProfile(nodeType);
  return p.cells || p.mesh;
}
