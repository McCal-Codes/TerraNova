import type { CellShapeGridResult } from "./cellShapeGrid";
import type { EvaluatedPosition } from "../positionEvaluator";
import { gridCornerToWorld } from "./previewSceneCoords";
import { forEachCellVoronoiEdge } from "./cellVoronoiEdges";
import { SHAPE_PREVIEW_COLORS } from "./shapePreviewColors";

export interface ShapeCellMapDrawOptions {
  size: number;
  rangeMin: number;
  rangeMax: number;
  showShapePreview: boolean;
  showCellBoundaries: boolean;
  showWallDistance: boolean;
  showMeshSamples: boolean;
  cellShapeGrid: CellShapeGridResult | null;
  meshPoints: EvaluatedPosition[];
}

function worldToCanvas(
  wx: number,
  wz: number,
  rangeMin: number,
  rangeMax: number,
  w: number,
  h: number,
): { px: number; py: number } {
  const span = rangeMax - rangeMin || 1;
  return {
    px: ((wx - rangeMin) / span) * w,
    py: ((wz - rangeMin) / span) * h,
  };
}

function drawWorldGrid(
  ctx: CanvasRenderingContext2D,
  rangeMin: number,
  rangeMax: number,
  w: number,
  h: number,
  gridStep = 16,
): void {
  ctx.lineWidth = 1;
  for (let wx = Math.ceil(rangeMin / gridStep) * gridStep; wx <= rangeMax; wx += gridStep) {
    const { px } = worldToCanvas(wx, rangeMin, rangeMin, rangeMax, w, h);
    ctx.strokeStyle = wx === 0 ? SHAPE_PREVIEW_COLORS.axis : SHAPE_PREVIEW_COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();
  }
  for (let wz = Math.ceil(rangeMin / gridStep) * gridStep; wz <= rangeMax; wz += gridStep) {
    const { py } = worldToCanvas(rangeMin, wz, rangeMin, rangeMax, w, h);
    ctx.strokeStyle = wz === 0 ? SHAPE_PREVIEW_COLORS.axis : SHAPE_PREVIEW_COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(w, py);
    ctx.stroke();
  }
}

function drawRangeLabels(
  ctx: CanvasRenderingContext2D,
  rangeMin: number,
  rangeMax: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = SHAPE_PREVIEW_COLORS.label;
  ctx.font = "9px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(String(rangeMin), 3, h - 4);
  ctx.textAlign = "right";
  ctx.fillText(String(rangeMax), w - 3, h - 4);
  ctx.textAlign = "left";
  ctx.fillText(String(rangeMin), 3, 10);
  ctx.textAlign = "right";
  ctx.fillText(String(rangeMax), w - 3, 10);
  ctx.textAlign = "left";
}

/** Paint the top-down XZ cell map into a 2D canvas context. */
export function drawShapeCellMap(
  ctx: CanvasRenderingContext2D,
  options: ShapeCellMapDrawOptions,
): void {
  const {
    size: w,
    rangeMin,
    rangeMax,
    showShapePreview,
    showCellBoundaries,
    showWallDistance,
    showMeshSamples,
    cellShapeGrid,
    meshPoints,
  } = options;
  const h = w;

  ctx.fillStyle = SHAPE_PREVIEW_COLORS.mapBackground;
  ctx.fillRect(0, 0, w, h);
  drawWorldGrid(ctx, rangeMin, rangeMax, w, h);

  if (showShapePreview && cellShapeGrid && showWallDistance) {
    const { resolution: n, wallDist } = cellShapeGrid;
    let maxWall = 0;
    for (let i = 0; i < wallDist.length; i++) {
      if (wallDist[i] > maxWall) maxWall = wallDist[i];
    }
    if (maxWall > 1e-6) {
      const cellW = w / n;
      const cellH = h / n;
      for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
          const idx = row * n + col;
          const t = wallDist[idx] / maxWall;
          const strength = (1 - t) * 0.55;
          if (strength < 0.04) continue;
          ctx.fillStyle = `${SHAPE_PREVIEW_COLORS.wallTint}${strength})`;
          ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
        }
      }
    }
  }

  if (showShapePreview && cellShapeGrid && showCellBoundaries) {
    const n = cellShapeGrid.resolution;
    ctx.strokeStyle = SHAPE_PREVIEW_COLORS.cellEdge;
    ctx.lineWidth = 1.25;

    forEachCellVoronoiEdge(cellShapeGrid, (c0, r0, c1, r1) => {
      const a = gridCornerToWorld(c0, r0, n, rangeMin, rangeMax);
      const b = gridCornerToWorld(c1, r1, n, rangeMin, rangeMax);
      const p0 = worldToCanvas(a.x, a.z, rangeMin, rangeMax, w, h);
      const p1 = worldToCanvas(b.x, b.z, rangeMin, rangeMax, w, h);
      ctx.beginPath();
      ctx.moveTo(p0.px, p0.py);
      ctx.lineTo(p1.px, p1.py);
      ctx.stroke();
    });
  }

  if (showShapePreview && showMeshSamples && meshPoints.length > 0) {
    for (const pt of meshPoints) {
      const { px, py } = worldToCanvas(pt.x, pt.z, rangeMin, rangeMax, w, h);
      if (px < -4 || px > w + 4 || py < -4 || py > h + 4) continue;
      const r = 2 + pt.weight * 2;
      ctx.fillStyle = SHAPE_PREVIEW_COLORS.mesh;
      ctx.globalAlpha = 0.35 + 0.65 * pt.weight;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawRangeLabels(ctx, rangeMin, rangeMax, w, h);
}
