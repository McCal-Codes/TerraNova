import { describe, expect, it } from "vitest";
import { getShapePreviewSliceY } from "@/hooks/useShapePreviewSliceY";
import {
  gridCornerToWorld,
  worldToVoxelScenePoint,
  worldXZToHeightfieldScene,
  worldToScenePoint,
} from "../previewSceneCoords";

describe("previewSceneCoords", () => {
  it("maps world XZ to centered heightfield scene span", () => {
    const { sceneX, sceneZ } = worldXZToHeightfieldScene(0, 100, 0, 100);
    expect(sceneX).toBeCloseTo(-25);
    expect(sceneZ).toBeCloseTo(25);
  });

  it("uses world coordinates directly in legacy world space", () => {
    const pt = worldToScenePoint(10, 42, 20, "world", 0, 100);
    expect(pt).toEqual([10, 42, 20]);
  });

  it("maps world coords into centered voxel scene space", () => {
    const map = {
      rangeMin: -64,
      rangeMax: 64,
      voxelYMin: 0,
      voxelYMax: 64,
      resolution: 64,
      ySlices: 64,
    };
    const origin = worldToVoxelScenePoint(0, 0, 0, map);
    expect(origin[1]).toBeCloseTo(-25, 1);
    const midY = worldToVoxelScenePoint(0, 32, 0, map);
    expect(midY[1]).toBeGreaterThan(-5);
    expect(midY[1]).toBeLessThan(5);
  });

  it("uses Y Level for slice in voxel mode when preferYLevel is set", () => {
    expect(getShapePreviewSliceY("voxel", 0, 0, 50, { preferYLevel: true })).toBe(0);
    expect(getShapePreviewSliceY("voxel", 64, 10, 90)).toBe(50);
    expect(getShapePreviewSliceY("2d", 64, 10, 90)).toBe(64);
  });

  it("grid corners span the preview range", () => {
    const c0 = gridCornerToWorld(0, 0, 64, 0, 128);
    const c1 = gridCornerToWorld(64, 64, 64, 0, 128);
    expect(c0).toEqual({ x: 0, z: 0 });
    expect(c1).toEqual({ x: 128, z: 128 });
  });
});
