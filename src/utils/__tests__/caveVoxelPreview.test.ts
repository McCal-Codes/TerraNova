import { describe, it, expect } from "vitest";
import { extractSurfaceVoxels, SOLID_THRESHOLD } from "@/utils/voxelExtractor";

/** Y-major layout: densities[yi * n * n + zi * n + xi] */
function writeVoxel(
  densities: Float32Array,
  n: number,
  xi: number,
  yi: number,
  zi: number,
  value: number,
) {
  densities[yi * n * n + zi * n + xi] = value;
}

describe("cave voxel preview", () => {
  it("extractSurfaceVoxels includes interior cave wall voxels, not only the top cap", () => {
    const n = 8;
    const ys = 8;
    const densities = new Float32Array(n * n * ys);

    // Solid column with a 2×2×2 void in the center (cave).
    for (let yi = 0; yi < ys; yi++) {
      for (let zi = 0; zi < n; zi++) {
        for (let xi = 0; xi < n; xi++) {
          const inVoid = xi >= 3 && xi <= 4 && zi >= 3 && zi <= 4 && yi >= 2 && yi <= 4;
          writeVoxel(densities, n, xi, yi, zi, inVoid ? -1 : 1);
        }
      }
    }

    const voxels = extractSurfaceVoxels(densities, n, ys);
    expect(voxels.count).toBeGreaterThan(n * n);

    let hasInteriorWall = false;
    for (let i = 0; i < voxels.count; i++) {
      const y = voxels.positions[i * 3 + 1];
      if (y >= 2 && y <= 4) {
        hasInteriorWall = true;
        break;
      }
    }
    expect(hasInteriorWall).toBe(true);
  });

  it("treats density >= 0 as solid per SOLID_THRESHOLD", () => {
    expect(SOLID_THRESHOLD).toBe(0);
  });
});
