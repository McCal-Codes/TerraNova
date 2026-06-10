import { Plane, Vector3 } from "three";
import { worldToVoxelScenePoint, type VoxelSceneMapping } from "@/utils/shapePreview/previewSceneCoords";

/** Build a Y-axis clip plane that hides geometry above `cutawayWorldY` in voxel scene space. */
export function buildCutawayClipPlane(
  cutawayWorldY: number,
  map: VoxelSceneMapping,
): Plane {
  const [, sceneY] = worldToVoxelScenePoint(0, cutawayWorldY, 0, map);
  // normal (0, -1, 0): discard fragments where -y + constant < 0  =>  y > constant
  return new Plane(new Vector3(0, -1, 0), sceneY);
}
