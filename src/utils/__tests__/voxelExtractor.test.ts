import { describe, expect, it } from "vitest";
import { fillTerrainColumnBacking, volumeDensityHasAir, SOLID_THRESHOLD } from "../voxelExtractor";

function makeVolume(n: number, ys: number, fill = -1): Float32Array {
  const d = new Float32Array(n * n * ys);
  d.fill(fill);
  return d;
}

function idx(x: number, y: number, z: number, n: number): number {
  return y * n * n + z * n + x;
}

describe("volumeDensityHasAir", () => {
  it("detects all-solid vs mixed volumes", () => {
    const solid = makeVolume(2, 2, 1);
    const mixed = makeVolume(2, 2, 1);
    mixed[0] = -1;
    expect(volumeDensityHasAir(solid)).toBe(false);
    expect(volumeDensityHasAir(mixed)).toBe(true);
  });
});

describe("fillTerrainColumnBacking", () => {
  it("fills air gaps below connected solids in a column", () => {
    const n = 4;
    const ys = 8;
    const d = makeVolume(n, ys);
    for (let y = 3; y <= 6; y++) setSolid(d, 1, y, 1, n);
    // hole inside the connected column
    d[idx(1, 4, 1, n)] = -0.5;

    const filled = fillTerrainColumnBacking(d, n, ys);
    expect(filled[idx(1, 4, 1, n)]).toBeGreaterThanOrEqual(SOLID_THRESHOLD);
  });

  it("does not fill air above the connected terrain body", () => {
    const n = 4;
    const ys = 8;
    const d = makeVolume(n, ys);
    setSolid(d, 1, 2, 1, n);
    d[idx(1, 5, 1, n)] = -1;

    const filled = fillTerrainColumnBacking(d, n, ys);
    expect(filled[idx(1, 5, 1, n)]).toBeLessThan(SOLID_THRESHOLD);
  });

  it("does not mutate the input buffer", () => {
    const n = 3;
    const ys = 4;
    const d = makeVolume(n, ys);
    setSolid(d, 1, 2, 1, n);
    const before = d[idx(1, 0, 1, n)];
    fillTerrainColumnBacking(d, n, ys);
    expect(d[idx(1, 0, 1, n)]).toBe(before);
  });
});

function setSolid(d: Float32Array, x: number, y: number, z: number, n: number, val = 1) {
  d[idx(x, y, z, n)] = val;
}
