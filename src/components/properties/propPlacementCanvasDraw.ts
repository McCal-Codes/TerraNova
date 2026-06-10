import type { EvaluatedPosition, WorldRange } from "@/utils/positionEvaluator";

export const PROP_PLACEMENT_BG = "#1c1a17";
export const PROP_PLACEMENT_GRID_COLOR = "rgba(74,68,56,0.3)";
export const PROP_PLACEMENT_AXIS_COLOR = "rgba(74,68,56,0.6)";
export const PROP_PLACEMENT_DOT_R = 107;
export const PROP_PLACEMENT_DOT_G = 158;
export const PROP_PLACEMENT_DOT_B = 90;
export const PROP_PLACEMENT_GRID_INTERVAL = 16;

export interface PropPlacementDrawOptions {
  width: number;
  height: number;
  worldRange: WorldRange;
  positions: EvaluatedPosition[];
  showGrid: boolean;
  showDensityOverlay: boolean;
  dotRadius?: number;
  showAxisLabels?: boolean;
}

export function drawPropPlacementCanvas(
  ctx: CanvasRenderingContext2D,
  {
    width: w,
    height: h,
    worldRange,
    positions,
    showGrid,
    showDensityOverlay,
    dotRadius = 2.5,
    showAxisLabels = true,
  }: PropPlacementDrawOptions,
): void {
  const { minX, maxX, minZ, maxZ } = worldRange;
  const rangeX = maxX - minX;
  const rangeZ = maxZ - minZ;

  ctx.fillStyle = PROP_PLACEMENT_BG;
  ctx.fillRect(0, 0, w, h);

  if (showGrid) {
    ctx.lineWidth = 1;

    for (let wx = Math.ceil(minX / PROP_PLACEMENT_GRID_INTERVAL) * PROP_PLACEMENT_GRID_INTERVAL; wx <= maxX; wx += PROP_PLACEMENT_GRID_INTERVAL) {
      const px = ((wx - minX) / rangeX) * w;
      ctx.strokeStyle = wx === 0 ? PROP_PLACEMENT_AXIS_COLOR : PROP_PLACEMENT_GRID_COLOR;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }

    for (let wz = Math.ceil(minZ / PROP_PLACEMENT_GRID_INTERVAL) * PROP_PLACEMENT_GRID_INTERVAL; wz <= maxZ; wz += PROP_PLACEMENT_GRID_INTERVAL) {
      const py = ((wz - minZ) / rangeZ) * h;
      ctx.strokeStyle = wz === 0 ? PROP_PLACEMENT_AXIS_COLOR : PROP_PLACEMENT_GRID_COLOR;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }
  }

  if (showDensityOverlay && positions.length > 0) {
    const cellCount = 16;
    const cellW = w / cellCount;
    const cellH = h / cellCount;
    const counts = new Float32Array(cellCount * cellCount);
    let maxCount = 0;

    for (const pos of positions) {
      const cx = Math.floor(((pos.x - minX) / rangeX) * cellCount);
      const cz = Math.floor(((pos.z - minZ) / rangeZ) * cellCount);
      if (cx >= 0 && cx < cellCount && cz >= 0 && cz < cellCount) {
        const idx = cz * cellCount + cx;
        counts[idx] += pos.weight;
        if (counts[idx] > maxCount) maxCount = counts[idx];
      }
    }

    if (maxCount > 0) {
      for (let cz = 0; cz < cellCount; cz++) {
        for (let cx = 0; cx < cellCount; cx++) {
          const density = counts[cz * cellCount + cx] / maxCount;
          if (density > 0) {
            ctx.fillStyle = `rgba(${PROP_PLACEMENT_DOT_R},${PROP_PLACEMENT_DOT_G},${PROP_PLACEMENT_DOT_B},${density * 0.4})`;
            ctx.fillRect(cx * cellW, cz * cellH, cellW, cellH);
          }
        }
      }
    }
  }

  for (const pos of positions) {
    const px = ((pos.x - minX) / rangeX) * w;
    const pz = ((pos.z - minZ) / rangeZ) * h;

    if (px < -dotRadius || px > w + dotRadius || pz < -dotRadius || pz > h + dotRadius) continue;

    const alpha = 0.3 + 0.7 * pos.weight;
    ctx.fillStyle = `rgba(${PROP_PLACEMENT_DOT_R},${PROP_PLACEMENT_DOT_G},${PROP_PLACEMENT_DOT_B},${alpha})`;
    ctx.beginPath();
    ctx.arc(px, pz, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (showAxisLabels) {
    ctx.fillStyle = "#9a9082";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${minX}`, 2, h - 3);
    ctx.textAlign = "right";
    ctx.fillText(`${maxX}`, w - 2, h - 3);
    ctx.textAlign = "left";
    ctx.fillText(`${minZ}`, 2, 10);
    ctx.textAlign = "right";
    ctx.fillText(`${maxZ}`, w - 2, 10);
  }
}
