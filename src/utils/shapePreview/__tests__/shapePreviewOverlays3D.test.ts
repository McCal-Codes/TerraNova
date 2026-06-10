import { describe, expect, it } from "vitest";
import type { ContourSegment } from "../marchingSquaresZeroContour";

/** Mirrors ShapePreviewOverlays3D world-space mapping for SDF segments. */
function segmentToWorldX(seg: ContourSegment, n: number, rangeMin: number, rangeMax: number): number {
  const worldRange = rangeMax - rangeMin || 1;
  return rangeMin + (seg.x1 / n) * worldRange;
}

describe("SDF overlay grid resolution", () => {
  it("maps voxel-resolution segments to world center, not half-scale when 2D grid is finer", () => {
    const seg: ContourSegment = { x1: 32, z1: 32, x2: 33, z2: 32 };
    const rangeMin = -64;
    const rangeMax = 64;
    const atVoxelN = segmentToWorldX(seg, 64, rangeMin, rangeMax);
    const wrongN = segmentToWorldX(seg, 128, rangeMin, rangeMax);
    expect(atVoxelN).toBe(0);
    expect(wrongN).toBe(-32);
  });
});
