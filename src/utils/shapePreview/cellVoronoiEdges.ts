import type { CellShapeGridResult } from "./cellShapeGrid";

/** Each Voronoi wall segment as grid corner indices (col, row). */
export function forEachCellVoronoiEdge(
  grid: CellShapeGridResult,
  visit: (c0: number, r0: number, c1: number, r1: number) => void,
): void {
  const { resolution: n, cellIds } = grid;

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n - 1; col++) {
      if (cellIds[row * n + col] === cellIds[row * n + col + 1]) continue;
      visit(col + 1, row, col + 1, row + 1);
    }
  }
  for (let col = 0; col < n; col++) {
    for (let row = 0; row < n - 1; row++) {
      if (cellIds[row * n + col] === cellIds[(row + 1) * n + col]) continue;
      visit(col, row + 1, col + 1, row + 1);
    }
  }
}
