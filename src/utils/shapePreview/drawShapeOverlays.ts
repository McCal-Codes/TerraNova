import type { CellShapeGridResult } from "./cellShapeGrid";
import type { ContourSegment } from "./marchingSquaresZeroContour";
import type { EvaluatedPosition } from "../positionEvaluator";

export interface GridToScreen {
  (gx: number, gz: number): { sx: number; sy: number };
}

import { SHAPE_PREVIEW_COLORS } from "./shapePreviewColors";

const MESH_COLOR = SHAPE_PREVIEW_COLORS.mesh;
const SDF_COLOR = SHAPE_PREVIEW_COLORS.sdf;
const CELL_EDGE_COLOR = SHAPE_PREVIEW_COLORS.cellEdge;

export function drawWallDistanceTint(
  ctx: CanvasRenderingContext2D,
  grid: CellShapeGridResult,
  gridToScreen: GridToScreen,
  show: boolean,
): void {
  if (!show) return;
  const n = grid.resolution;
  let maxWall = 0;
  for (let i = 0; i < grid.wallDist.length; i++) {
    if (grid.wallDist[i] > maxWall) maxWall = grid.wallDist[i];
  }
  if (maxWall < 1e-6) return;

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const w = grid.wallDist[row * n + col] / maxWall;
      const alpha = (1 - w) * 0.35;
      if (alpha < 0.02) continue;
      const { sx, sy } = gridToScreen(col + 0.5, row + 0.5);
      ctx.fillStyle = `${SHAPE_PREVIEW_COLORS.wallTint}${alpha})`;
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
    }
  }
}

export function drawCellBoundaries(
  ctx: CanvasRenderingContext2D,
  grid: CellShapeGridResult,
  gridToScreen: GridToScreen,
  show: boolean,
): void {
  if (!show) return;
  const n = grid.resolution;
  ctx.strokeStyle = CELL_EDGE_COLOR;
  ctx.lineWidth = 1.2;

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!grid.edgeMask[row * n + col]) continue;
      const { sx, sy } = gridToScreen(col + 0.5, row + 0.5);
      ctx.strokeRect(sx - 1.5, sy - 1.5, 3, 3);
    }
  }
}

export function drawSdfZeroContour(
  ctx: CanvasRenderingContext2D,
  segments: ContourSegment[],
  gridToScreen: GridToScreen,
  show: boolean,
): void {
  if (!show || segments.length === 0) return;
  ctx.strokeStyle = SDF_COLOR;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  for (const seg of segments) {
    const p1 = gridToScreen(seg.x1, seg.z1);
    const p2 = gridToScreen(seg.x2, seg.z2);
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.stroke();
  }
}

export function drawShapeMeshPoints(
  ctx: CanvasRenderingContext2D,
  points: EvaluatedPosition[],
  rangeMin: number,
  rangeMax: number,
  n: number,
  gridToScreen: GridToScreen,
  show: boolean,
): void {
  if (!show || points.length === 0) return;
  const worldRange = rangeMax - rangeMin;
  ctx.fillStyle = MESH_COLOR;

  for (const pt of points) {
    const gx = ((pt.x - rangeMin) / worldRange) * n;
    const gz = ((pt.z - rangeMin) / worldRange) * n;
    const { sx, sy } = gridToScreen(gx, gz);
    ctx.globalAlpha = 0.35 + 0.65 * pt.weight;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
