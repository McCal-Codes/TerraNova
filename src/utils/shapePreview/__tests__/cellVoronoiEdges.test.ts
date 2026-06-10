import { describe, expect, it } from "vitest";
import { forEachCellVoronoiEdge } from "../cellVoronoiEdges";
import type { CellShapeGridResult } from "../cellShapeGrid";

function tinyGrid(cellIds: number[]): CellShapeGridResult {
  const n = 2;
  return {
    resolution: n,
    cellIds: Uint32Array.from(cellIds),
    wallDist: new Float32Array(n * n),
    edgeMask: new Uint8Array(n * n),
  };
}

describe("forEachCellVoronoiEdge", () => {
  it("emits vertical edge when column neighbors differ", () => {
    const edges: string[] = [];
    forEachCellVoronoiEdge(tinyGrid([0, 1, 0, 1]), (c0, r0, c1, r1) => {
      edges.push(`${c0},${r0}-${c1},${r1}`);
    });
    expect(edges).toContain("1,0-1,1");
    expect(edges).toContain("1,1-1,2");
  });

  it("skips edges between same cell id", () => {
    let count = 0;
    forEachCellVoronoiEdge(tinyGrid([0, 0, 0, 0]), () => {
      count++;
    });
    expect(count).toBe(0);
  });
});
