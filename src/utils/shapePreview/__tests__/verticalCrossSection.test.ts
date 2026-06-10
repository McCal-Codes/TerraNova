import { describe, it, expect } from "vitest";
import { sampleVerticalCrossSection } from "@/utils/verticalCrossSection";

describe("verticalCrossSection", () => {
  it("samples a vertical wall with air band in the middle", () => {
    const n = 4;
    const ys = 4;
    const densities = new Float32Array(n * n * ys);

    for (let yi = 0; yi < ys; yi++) {
      for (let zi = 0; zi < n; zi++) {
        for (let xi = 0; xi < n; xi++) {
          const solid = yi === 0 || yi === 3;
          densities[yi * n * n + zi * n + xi] = solid ? 1 : -1;
        }
      }
    }

    const grid = sampleVerticalCrossSection(
      densities,
      n,
      ys,
      -8,
      8,
      0,
      12,
      { x: -8, z: -8 },
      { x: 8, z: -8 },
      8,
      4,
    );

    expect(grid.width).toBe(8);
    expect(grid.height).toBe(4);
    const mid = grid.values[1 * grid.width + 2];
    expect(mid).toBeLessThan(0);
    const bottom = grid.values[0 * grid.width + 2];
    expect(bottom).toBeGreaterThanOrEqual(0);
  });
});
