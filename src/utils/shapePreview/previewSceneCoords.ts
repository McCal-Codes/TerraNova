/** Matches voxel mesh build in useVoxelEvaluation (centered ±sceneSize/2 scene). */
export const VOXEL_PREVIEW_SCENE_SIZE = 50;

/** How preview 3D scenes map world coordinates to Three.js space. */
export type PreviewSceneSpace = "heightfield" | "world" | "voxelScene";

export interface VoxelSceneMapping {
  rangeMin: number;
  rangeMax: number;
  voxelYMin: number;
  voxelYMax: number;
  resolution: number;
  ySlices: number;
  sceneSize?: number;
}

/** Same transform as buildVoxelMeshes scale/offset in useVoxelEvaluation. */
export function worldToVoxelScenePoint(
  worldX: number,
  worldY: number,
  worldZ: number,
  map: VoxelSceneMapping,
): [number, number, number] {
  const sceneSize = map.sceneSize ?? VOXEL_PREVIEW_SCENE_SIZE;
  const n = map.resolution;
  const ys = Math.max(1, map.ySlices);
  const worldRangeXZ = map.rangeMax - map.rangeMin || 1;
  const worldRangeY = map.voxelYMax - map.voxelYMin || 1;
  const xzDiv = n > 1 ? n - 1 : 1;
  const yDiv = ys > 1 ? ys - 1 : 1;

  const bx = ((worldX - map.rangeMin) / worldRangeXZ) * xzDiv;
  const bz = ((worldZ - map.rangeMin) / worldRangeXZ) * xzDiv;
  const by = ((worldY - map.voxelYMin) / worldRangeY) * yDiv;

  const scaleX = sceneSize / n;
  const scaleZ = sceneSize / n;
  const scaleY = sceneSize / Math.max(n, ys);
  const off = -sceneSize / 2;

  return [bx * scaleX + off, by * scaleY + off, bz * scaleZ + off];
}
export function worldXZToHeightfieldScene(
  x: number,
  z: number,
  rangeMin: number,
  rangeMax: number,
): { sceneX: number; sceneZ: number } {
  const worldRange = rangeMax - rangeMin || 1;
  const normX = (x - rangeMin) / worldRange;
  const normZ = (z - rangeMin) / worldRange;
  return {
    sceneX: (normX - 0.5) * 50,
    sceneZ: (normZ - 0.5) * 50,
  };
}

export function sampleHeightfieldSceneY(
  worldX: number,
  worldZ: number,
  values: Float32Array | null,
  resolution: number,
  rangeMin: number,
  rangeMax: number,
  heightScale3D: number,
  minValue: number,
  maxValue: number,
  p02Value?: number,
  p98Value?: number,
): number {
  const worldRange = rangeMax - rangeMin || 1;
  const n = values ? Math.round(Math.sqrt(values.length)) : resolution;
  if (!values || n <= 0) return 0.2;

  const normX = (worldX - rangeMin) / worldRange;
  const normZ = (worldZ - rangeMin) / worldRange;
  const col = Math.floor(normX * n);
  const row = Math.floor(normZ * n);
  if (col < 0 || col >= n || row < 0 || row >= n) return 0.2;

  const lo = p02Value ?? minValue;
  const hi = p98Value ?? maxValue;
  const range = hi - lo || 1;
  const isFlat = Math.abs(hi - lo) < 1e-8;
  const idx = row * n + col;
  const normalized = isFlat ? 0.5 : Math.max(0, Math.min(1, (values[idx] - lo) / range));
  return normalized * heightScale3D + 0.15;
}

export function worldToScenePoint(
  worldX: number,
  worldY: number,
  worldZ: number,
  space: PreviewSceneSpace,
  rangeMin: number,
  rangeMax: number,
  heightfield?: {
    values: Float32Array | null;
    resolution: number;
    heightScale3D: number;
    minValue: number;
    maxValue: number;
    p02Value?: number;
    p98Value?: number;
  },
  voxelScene?: VoxelSceneMapping,
): [number, number, number] {
  if (space === "voxelScene") {
    if (!voxelScene) {
      return [worldX, worldY, worldZ];
    }
    return worldToVoxelScenePoint(worldX, worldY, worldZ, voxelScene);
  }
  if (space === "world") {
    return [worldX, worldY, worldZ];
  }
  const { sceneX, sceneZ } = worldXZToHeightfieldScene(worldX, worldZ, rangeMin, rangeMax);
  const sceneY = heightfield
    ? sampleHeightfieldSceneY(
        worldX,
        worldZ,
        heightfield.values,
        heightfield.resolution,
        rangeMin,
        rangeMax,
        heightfield.heightScale3D,
        heightfield.minValue,
        heightfield.maxValue,
        heightfield.p02Value,
        heightfield.p98Value,
      )
    : 0.15;
  return [sceneX, sceneY, sceneZ];
}

export function gridIndexToWorld(
  col: number,
  row: number,
  n: number,
  rangeMin: number,
  rangeMax: number,
): { x: number; z: number } {
  const worldRange = rangeMax - rangeMin;
  return {
    x: rangeMin + ((col + 0.5) / n) * worldRange,
    z: rangeMin + ((row + 0.5) / n) * worldRange,
  };
}

/** Grid corner (cell boundary) in world XZ. */
export function gridCornerToWorld(
  col: number,
  row: number,
  n: number,
  rangeMin: number,
  rangeMax: number,
): { x: number; z: number } {
  const worldRange = rangeMax - rangeMin;
  return {
    x: rangeMin + (col / n) * worldRange,
    z: rangeMin + (row / n) * worldRange,
  };
}
