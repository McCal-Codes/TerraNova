import {
  ShapePreviewCellLines3D,
  ShapePreviewSdfLines3D,
} from "./ShapePreviewOverlays3D";
import { ShapePreviewMeshMarkers3D } from "./ShapePreviewMeshMarkers3D";
import { ShapePreviewWallPlane3D } from "./ShapePreviewWallPlane3D";
import type { PreviewSceneSpace } from "@/utils/shapePreview/previewSceneCoords";

interface ShapePreview3DProps {
  space: PreviewSceneSpace;
  /** World Y for overlays in voxel/world space (defaults to preview yLevel). */
  sliceWorldY?: number;
}

/** All shape-preview layers for a 3D preview scene. */
export function ShapePreview3D({ space, sliceWorldY }: ShapePreview3DProps) {
  return (
    <>
      <ShapePreviewWallPlane3D space={space} sliceWorldY={sliceWorldY} />
      <ShapePreviewCellLines3D space={space} sliceWorldY={sliceWorldY} />
      <ShapePreviewSdfLines3D space={space} sliceWorldY={sliceWorldY} />
      <ShapePreviewMeshMarkers3D space={space} sliceWorldY={sliceWorldY} />
    </>
  );
}
