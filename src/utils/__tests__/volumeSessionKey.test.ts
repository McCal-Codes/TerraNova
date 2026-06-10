import { describe, expect, it } from "vitest";
import { computeVoxelEvalKey } from "@/utils/volumeSessionKey";

describe("computeVoxelEvalKey", () => {
  it("changes when graph fingerprint or voxel params change", () => {
    const base = {
      evalFingerprint: "abc123",
      rangeMin: -64,
      rangeMax: 64,
      yLevel: 0,
      voxelYMin: -32,
      voxelYMax: 32,
      voxelYSlices: 96,
      targetRes: 256,
      showMaterialColors: true,
    };
    const keyA = computeVoxelEvalKey(base);
    expect(keyA).toContain("abc123");
    expect(computeVoxelEvalKey({ ...base, targetRes: 128 })).not.toBe(keyA);
    expect(computeVoxelEvalKey({ ...base, showMaterialColors: false })).not.toBe(keyA);
    expect(computeVoxelEvalKey({ ...base, evalFingerprint: "def456" })).not.toBe(keyA);
  });
});
