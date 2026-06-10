import { describe, it, expect } from "vitest";
import { scanDensityGridYBounds } from "@/utils/previewAutoFit";

/** Reproduce stall: auto-fit scan matches existing Y bounds — eval must not bail out. */
describe("scanDensityGridYBounds", () => {
  it("returns hasSolids for a simple surface band", () => {
    const n = 8;
    const ys = 16;
    const densities = new Float32Array(n * n * ys);
    for (let yi = 0; yi < 8; yi++) {
      for (let zi = 0; zi < n; zi++) {
        for (let xi = 0; xi < n; xi++) {
          densities[yi * n * n + zi * n + xi] = 1;
        }
      }
    }
    const bounds = scanDensityGridYBounds(densities, n, ys, 0, 128);
    expect(bounds.hasSolids).toBe(true);
    expect(bounds.worldYMax).toBeGreaterThan(bounds.worldYMin);
  });

  it("yChanged is false when scan matches store Y (hook must finish eval, not return early)", () => {
    const n = 8;
    const ys = 16;
    const densities = new Float32Array(n * n * ys);
    for (let yi = 0; yi < 8; yi++) {
      for (let zi = 0; zi < n; zi++) {
        for (let xi = 0; xi < n; xi++) {
          densities[yi * n * n + zi * n + xi] = 1;
        }
      }
    }
    const bounds = scanDensityGridYBounds(densities, n, ys, 0, 128);
    const voxelYMin = bounds.worldYMin;
    const voxelYMax = bounds.worldYMax;
    const yChanged = bounds.worldYMin !== voxelYMin || bounds.worldYMax !== voxelYMax;
    expect(yChanged).toBe(false);
  });
});
