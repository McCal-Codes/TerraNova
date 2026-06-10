import { describe, expect, it } from "vitest";
import {
  fitToContentBoundsFromResult,
  type Bounds3DResult,
} from "@/utils/previewAutoFit";

describe("fitToContentBoundsFromResult", () => {
  it("returns null when no solids", () => {
    const bounds: Bounds3DResult = {
      worldXMin: -10,
      worldXMax: 10,
      worldYMin: 60,
      worldYMax: 80,
      worldZMin: -10,
      worldZMax: 10,
      hasSolids: false,
    };
    expect(fitToContentBoundsFromResult(bounds)).toBeNull();
  });

  it("derives symmetric XZ range with padding and clamps", () => {
    const bounds: Bounds3DResult = {
      worldXMin: -42,
      worldXMax: 18,
      worldYMin: 55,
      worldYMax: 92,
      worldZMin: -5,
      worldZMax: 30,
      hasSolids: true,
    };
    expect(fitToContentBoundsFromResult(bounds)).toEqual({
      rangeMin: -42,
      rangeMax: 42,
      voxelYMin: 55,
      voxelYMax: 92,
    });
  });

  it("enforces minimum half-extent of 8 blocks", () => {
    const bounds: Bounds3DResult = {
      worldXMin: -2,
      worldXMax: 3,
      worldYMin: 64,
      worldYMax: 70,
      worldZMin: -1,
      worldZMax: 2,
      hasSolids: true,
    };
    expect(fitToContentBoundsFromResult(bounds)).toEqual({
      rangeMin: -8,
      rangeMax: 8,
      voxelYMin: 64,
      voxelYMax: 70,
    });
  });
});
