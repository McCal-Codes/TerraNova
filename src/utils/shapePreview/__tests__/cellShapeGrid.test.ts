import { describe, it, expect } from "vitest";
import { evaluateCellShapeGrid } from "../cellShapeGrid";
import { lastVoronoiCellHash, voronoiNoise2D } from "../../density/voronoiNoise";
import { mulberry32 } from "../../density/prng";

describe("evaluateCellShapeGrid", () => {
  it("produces cell ids and edges on a small grid", () => {
    const grid = evaluateCellShapeGrid(-32, 32, 16, {
      scale: 50,
      seed: "shape-test",
      jitter: 0.5,
    });
    expect(grid.resolution).toBe(16);
    expect(grid.cellIds.length).toBe(256);
    expect(grid.edgeMask.length).toBe(256);

    let edgeCount = 0;
    for (let i = 0; i < grid.edgeMask.length; i++) {
      if (grid.edgeMask[i]) edgeCount++;
    }
    expect(edgeCount).toBeGreaterThan(0);

    let distinctIds = new Set<number>();
    for (let i = 0; i < grid.cellIds.length; i++) {
      distinctIds.add(grid.cellIds[i]);
    }
    expect(distinctIds.size).toBeGreaterThan(1);
  });

  it("wall distance is non-negative", () => {
    const grid = evaluateCellShapeGrid(-16, 16, 8, { scale: 20, seed: 1 });
    for (let i = 0; i < grid.wallDist.length; i++) {
      expect(grid.wallDist[i]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("voronoi side channel", () => {
  it("exports cell hash after 2D sample", () => {
    const rng = mulberry32(42);
    const noise = voronoiNoise2D(rng, "Distance", 1.0, "Distance", "Euclidean", 42);
    noise(12.5, -7.25);
    expect(lastVoronoiCellHash).not.toBe(0);
  });
});
