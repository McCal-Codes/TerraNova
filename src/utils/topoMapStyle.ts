import { getContourLevels, type ContourSet } from "./contourLines";
import {
  HYDRO_DENSITY_THRESHOLD,
  isHydrographyCellAtSlice,
  type HydrographySliceParams,
} from "./hydrographyContext";

/** USGS-style printed map palette (public-domain cartographic conventions). */
export const USGS_PARCHMENT_RGB: [number, number, number] = [245, 240, 225];
export const USGS_LOW_ELEV_RGB: [number, number, number] = [194, 172, 132];
export const USGS_MID_ELEV_RGB: [number, number, number] = [222, 210, 178];
export const USGS_HIGH_ELEV_RGB: [number, number, number] = [250, 244, 232];
export const USGS_BARREN_RGB: [number, number, number] = [210, 200, 188];
export const USGS_FOREST_RGB: [number, number, number] = [118, 158, 96];
export const USGS_WATER_RGB: [number, number, number] = [140, 188, 222];
export const USGS_WETLAND_RGB: [number, number, number] = [168, 198, 168];
export const USGS_CONTOUR_BROWN = "#8b6914";
export const USGS_INDEX_CONTOUR_BROWN = "#5c3d1e";
export const USGS_CONTOUR_LABEL = "#4a3728";
export const USGS_DEPRESSION_CONTOUR = "#6b7f9a";
export const USGS_NEATLINE = "#5c3d1e";
export const USGS_NEATLINE_INNER = "#8b6914";

/** Shared HUD chrome tokens (HTML panels on topo preview). */
export const USGS_HUD = {
  insetPx: 14,
  railGapPx: 8,
  panelBg: "#faf6eb",
  panelBorder: "#c4b89a",
  ink: USGS_CONTOUR_LABEL,
  inkMuted: "rgba(74, 55, 40, 0.72)",
  inkFaint: "rgba(74, 55, 40, 0.55)",
  accent: USGS_NEATLINE,
  woodland: "#8cbe96",
  hydro: "#8cb8de",
  marginReservePx: 112,
} as const;

export function isIndexContourLevel(level: number, interval: number): boolean {
  if (interval <= 0) return false;
  if (Math.abs(level) < interval * 0.05) return true;
  const steps = Math.round(level / interval);
  return Math.abs(level - steps * interval) < interval * 0.05 && steps % 5 === 0;
}

/** Readable elevation-style label for a contour density level. */
export function formatContourLabel(level: number): string {
  if (Math.abs(level) < 1e-6) return "0";
  const abs = Math.abs(level);
  if (abs >= 100) return String(Math.round(level));
  if (abs >= 10) return String(Math.round(level));
  if (abs >= 1) return level.toFixed(0);
  return level.toFixed(1);
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * u),
    Math.round(a[1] + (b[1] - a[1]) * u),
    Math.round(a[2] + (b[2] - a[2]) * u),
  ];
}

/** Subtle hypsometric bands — low tan, mid parchment, high buff (printed quadrangle look). */
export function sampleUsgsHypsometricTint(norm: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, norm));
  if (t < 0.22) return lerpRgb(USGS_LOW_ELEV_RGB, USGS_PARCHMENT_RGB, t / 0.22);
  if (t < 0.55) return lerpRgb(USGS_PARCHMENT_RGB, USGS_MID_ELEV_RGB, (t - 0.22) / 0.33);
  if (t < 0.82) return lerpRgb(USGS_MID_ELEV_RGB, USGS_HIGH_ELEV_RGB, (t - 0.55) / 0.27);
  return lerpRgb(USGS_HIGH_ELEV_RGB, [252, 248, 238], (t - 0.82) / 0.18);
}

/**
 * Combine hypsometric tint with Lambertian hillshade and slope darkening
 * (printed shaded-relief quadrangle look).
 */
export function shadeUsgsReliefPixel(
  tint: [number, number, number],
  hillshade: number,
  slopeMag: number,
): [number, number, number] {
  const relief = 0.48 + 0.52 * hillshade;
  const slopeDark = Math.max(0.78, 1 - slopeMag * 0.55);
  const factor = relief * slopeDark;
  return [
    Math.min(255, Math.round(tint[0] * factor)),
    Math.min(255, Math.round(tint[1] * factor)),
    Math.min(255, Math.round(tint[2] * factor)),
  ];
}

/** Deterministic paper grain — subtle print texture without extra assets. */
function paperGrainNoise(col: number, row: number): number {
  const h = ((col * 374761393 + row * 668265263) ^ (col << 7)) & 0xffff;
  return (h / 32768 - 1) * 6;
}

export function applyUsgsPaperGrain(data: Uint8ClampedArray, n: number): void {
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const px = (row * n + col) * 4;
      const grain = paperGrainNoise(col, row);
      data[px] = Math.max(0, Math.min(255, Math.round(data[px] + grain)));
      data[px + 1] = Math.max(0, Math.min(255, Math.round(data[px + 1] + grain * 0.95)));
      data[px + 2] = Math.max(0, Math.min(255, Math.round(data[px + 2] + grain * 0.88)));
    }
  }
}

/** Soft edge darkening — aged paper vignette on the map face. */
export function applyUsgsParchmentVignette(data: Uint8ClampedArray, n: number): void {
  const cx = (n - 1) / 2;
  const cy = (n - 1) / 2;
  const maxDist = Math.hypot(cx, cy) || 1;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const dist = Math.hypot(col - cx, row - cy) / maxDist;
      const vignette = 1 - 0.14 * dist * dist;
      const px = (row * n + col) * 4;
      data[px] = Math.round(data[px] * vignette);
      data[px + 1] = Math.round(data[px + 1] * vignette);
      data[px + 2] = Math.round(data[px + 2] * vignette);
    }
  }
}

/** Contour levels using percentile span; always includes d = 0 when it lies in range. */
export function getUsgsContourLevels(min: number, max: number, interval: number): number[] {
  const levels = getContourLevels(min, max, interval);
  if (min < 0 && max > 0 && !levels.some((level) => Math.abs(level) < interval * 0.05)) {
    levels.push(0);
    levels.sort((a, b) => a - b);
  }
  return levels;
}

export interface GridToScreen {
  (gx: number, gz: number): { sx: number; sy: number };
}

function blendRgb(
  data: Uint8ClampedArray,
  px: number,
  tint: [number, number, number],
  alpha: number,
): void {
  data[px] = Math.round(data[px] * (1 - alpha) + tint[0] * alpha);
  data[px + 1] = Math.round(data[px + 1] * (1 - alpha) + tint[1] * alpha);
  data[px + 2] = Math.round(data[px + 2] * (1 - alpha) + tint[2] * alpha);
}

/** Woodland, hydrography, and barren washes layered on hypsometric base. */
export function applyUsgsLandCoverWash(
  data: Uint8ClampedArray,
  values: Float32Array,
  lo: number,
  hi: number,
  hydro?: HydrographySliceParams | null,
): void {
  const span = hi - lo || 1;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const px = i * 4;
    if (v < 0) {
      if (
        hydro
        && isHydrographyCellAtSlice(v, hydro.yLevel, hydro.waterSurfaceY)
      ) {
        const depth = Math.min(1, Math.abs(v) / Math.max(0.35, Math.abs(lo)));
        if (v > -0.1) {
          blendRgb(data, px, USGS_WETLAND_RGB, 0.14 + 0.28 * (1 - depth));
        }
        blendRgb(data, px, USGS_WATER_RGB, 0.16 + 0.48 * depth);
      }
      continue;
    }

    const norm = Math.max(0, Math.min(1, (v - lo) / span));

    // Valley and mid-slope woodland
    if (norm >= 0.12 && norm <= 0.62) {
      const valley = norm < 0.38 ? (0.38 - norm) / 0.26 : 0;
      const mid = 1 - Math.abs(norm - 0.42) / 0.42;
      const strength = 0.06 + 0.28 * Math.max(valley * 0.6, mid);
      blendRgb(data, px, USGS_FOREST_RGB, Math.min(0.38, strength));
    }

    // High ridges — subtle barren tint
    if (norm > 0.78) {
      blendRgb(data, px, USGS_BARREN_RGB, 0.06 + 0.2 * ((norm - 0.78) / 0.22));
    }
  }
}

export function drawUsgsContours(
  ctx: CanvasRenderingContext2D,
  contourData: ContourSet,
  gridToScreen: GridToScreen,
  contourInterval: number,
): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const contour of contourData) {
    const isIndex = isIndexContourLevel(contour.level, contourInterval);
    const isDepression = contour.level < -contourInterval * 0.05;
    ctx.strokeStyle = isDepression
      ? USGS_DEPRESSION_CONTOUR
      : isIndex
        ? USGS_INDEX_CONTOUR_BROWN
        : USGS_CONTOUR_BROWN;
    ctx.lineWidth = isIndex ? 1.6 : 0.65;
    ctx.setLineDash(isDepression ? [5, 4] : []);

    for (const seg of contour.segments) {
      const p1 = gridToScreen(seg.x1, seg.z1);
      const p2 = gridToScreen(seg.x2, seg.z2);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.stroke();

      if (isIndex && !isDepression) {
        drawContourEndpointTicks(ctx, p1, p2, 4);
      }
    }
  }
  ctx.setLineDash([]);
}

function drawContourEndpointTicks(
  ctx: CanvasRenderingContext2D,
  p1: { sx: number; sy: number },
  p2: { sx: number; sy: number },
  tickLen: number,
): void {
  const dx = p2.sx - p1.sx;
  const dy = p2.sy - p1.sy;
  const len = Math.hypot(dx, dy);
  if (len < 8) return;
  const nx = -dy / len;
  const ny = dx / len;
  const half = tickLen / 2;

  for (const pt of [p1, p2]) {
    ctx.beginPath();
    ctx.moveTo(pt.sx - nx * half, pt.sy - ny * half);
    ctx.lineTo(pt.sx + nx * half, pt.sy + ny * half);
    ctx.stroke();
  }
}

export function drawUsgsContourLabels(
  ctx: CanvasRenderingContext2D,
  contourData: ContourSet,
  gridToScreen: GridToScreen,
  contourInterval: number,
  n: number,
): void {
  const placed = new Set<string>();
  ctx.font = "bold 9px Georgia, 'Times New Roman', serif";
  ctx.fillStyle = USGS_CONTOUR_LABEL;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const contour of contourData) {
    if (!isIndexContourLevel(contour.level, contourInterval)) continue;
    const label = formatContourLabel(contour.level);
    let count = 0;
    const minSegLen = n * 0.05;

    for (const seg of contour.segments) {
      if (count >= 8) break;
      const len = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
      if (len < minSegLen) continue;
      const mx = (seg.x1 + seg.x2) / 2;
      const mz = (seg.z1 + seg.z2) / 2;
      const cellKey = `${contour.level}:${Math.floor(mx / 3)}:${Math.floor(mz / 3)}`;
      if (placed.has(cellKey)) continue;
      placed.add(cellKey);

      const p1 = gridToScreen(seg.x1, seg.z1);
      const p2 = gridToScreen(seg.x2, seg.z2);
      const { sx, sy } = gridToScreen(mx, mz);

      let angle = Math.atan2(p2.sy - p1.sy, p2.sx - p1.sx);
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;

      const metrics = ctx.measureText(label);
      const padX = 3;
      const padY = 2;
      const boxW = metrics.width + padX * 2;
      const boxH = 11 + padY * 2;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);
      ctx.fillStyle = "rgba(250, 246, 235, 0.92)";
      ctx.strokeStyle = "rgba(139, 105, 20, 0.35)";
      ctx.lineWidth = 0.5;
      ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
      ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);
      ctx.fillStyle = USGS_CONTOUR_LABEL;
      ctx.fillText(label, 0, 1);
      ctx.restore();
      count += 1;
    }
  }
}

/** Double-line map border (USGS neatline) with corner registration marks. */
export function drawUsgsNeatline(ctx: CanvasRenderingContext2D, displaySize: number, inset = 10): void {
  const outer = inset;
  const inner = inset + 3;
  const x1 = displaySize - inset;
  const y1 = displaySize - inset;

  ctx.strokeStyle = USGS_NEATLINE;
  ctx.lineWidth = 1.25;
  ctx.strokeRect(outer, outer, x1 - outer * 2, y1 - outer * 2);

  ctx.strokeStyle = USGS_NEATLINE_INNER;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(inner, inner, x1 - inner * 2, y1 - inner * 2);

  const tick = 6;
  ctx.strokeStyle = USGS_NEATLINE;
  ctx.lineWidth = 0.75;
  const corners: [number, number, number, number][] = [
    [outer, outer, tick, tick],
    [x1, outer, -tick, tick],
    [outer, y1, tick, -tick],
    [x1, y1, -tick, -tick],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx, cy);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + dy);
    ctx.stroke();
  }
}

/** Simple north arrow with serif N (cartographic convention). */
export function drawUsgsNorthArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size = 22,
): void {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = USGS_NEATLINE;
  ctx.strokeStyle = USGS_NEATLINE;
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.55);
  ctx.lineTo(size * 0.28, size * 0.35);
  ctx.lineTo(0, size * 0.12);
  ctx.lineTo(-size * 0.28, size * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 10px Georgia, 'Times New Roman', serif";
  ctx.fillStyle = USGS_CONTOUR_LABEL;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("N", 0, -size * 0.58);
  ctx.restore();
}

/** Pick a round world-unit length for the scale bar. */
export function pickUsgsScaleBarBlocks(worldRange: number, barPixels: number, pixelsPerBlock: number): number {
  if (pixelsPerBlock <= 0 || worldRange <= 0) return 8;
  const targetBlocks = barPixels / pixelsPerBlock;
  const candidates = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
  let best = candidates[0];
  let bestDiff = Infinity;
  for (const c of candidates) {
    if (c > worldRange) continue;
    const diff = Math.abs(c - targetBlocks);
    if (diff < bestDiff) {
      best = c;
      bestDiff = diff;
    }
  }
  return best;
}

export function drawUsgsScaleBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  blocks: number,
  barWidthPx: number,
): void {
  const h = 5;
  ctx.fillStyle = USGS_CONTOUR_LABEL;
  ctx.strokeStyle = USGS_NEATLINE;
  ctx.lineWidth = 0.75;

  ctx.fillRect(x, y, barWidthPx / 2, h);
  ctx.strokeRect(x, y, barWidthPx, h);
  ctx.beginPath();
  ctx.moveTo(x + barWidthPx / 2, y);
  ctx.lineTo(x + barWidthPx / 2, y + h);
  ctx.stroke();

  ctx.font = "9px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`0`, x, y + h + 2);
  ctx.fillText(`${blocks}`, x + barWidthPx, y + h + 2);
  ctx.textAlign = "start";
  ctx.fillText("blocks", x + barWidthPx + 4, y + h + 2);
}

function inLeftHudBand(sy: number, displaySize: number, reserve: number): boolean {
  return sy < reserve || sy > displaySize - reserve;
}

/** Tick labels along the neatline for world X/Z coordinates. */
export function drawUsgsMarginTicks(
  ctx: CanvasRenderingContext2D,
  displaySize: number,
  rangeMin: number,
  rangeMax: number,
  gridSpacing: number,
  gridToScreen: GridToScreen,
  n: number,
  inset = 10,
  avoidHudCorners = false,
): void {
  const worldRange = rangeMax - rangeMin;
  const gridStart = Math.ceil(rangeMin / gridSpacing) * gridSpacing;

  ctx.font = "8px Georgia, 'Times New Roman', serif";
  ctx.fillStyle = "rgba(74, 55, 40, 0.72)";
  ctx.strokeStyle = "rgba(92, 64, 30, 0.45)";
  ctx.lineWidth = 0.5;

  for (let w = gridStart; w <= rangeMax; w += gridSpacing) {
    const g = ((w - rangeMin) / worldRange) * n;
    const { sx } = gridToScreen(g, 0);
    if (sx < inset + 4 || sx > displaySize - inset - 4) continue;

    ctx.beginPath();
    ctx.moveTo(sx, inset);
    ctx.lineTo(sx, inset + 4);
    ctx.stroke();
    // Top numeric labels omitted when HTML HUD rails cover the margin
    if (!avoidHudCorners) {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(String(Math.round(w)), sx, inset + 5);
    }

    const { sy } = gridToScreen(0, g);
    if (sy < inset + 4 || sy > displaySize - inset - 16) continue;
    ctx.beginPath();
    ctx.moveTo(inset, sy);
    ctx.lineTo(inset + 4, sy);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    if (!avoidHudCorners || !inLeftHudBand(sy, displaySize, USGS_HUD.marginReservePx)) {
      ctx.fillText(String(Math.round(w)), inset + 6, sy);
    }
  }
}

export interface SpotElevation {
  gx: number;
  gz: number;
  value: number;
  kind: "peak" | "depression";
}

/** Local extrema for spot elevation markers (peaks and closed depressions). */
export function findUsgsSpotElevations(
  values: Float32Array,
  n: number,
  maxPeaks = 5,
  maxDepressions = 3,
): SpotElevation[] {
  const minSep = Math.max(3, Math.floor(n / 14));
  const peaks: SpotElevation[] = [];
  const depressions: SpotElevation[] = [];

  for (let row = 1; row < n - 1; row++) {
    for (let col = 1; col < n - 1; col++) {
      const i = row * n + col;
      const v = values[i];
      let isMax = true;
      let isMin = true;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nv = values[(row + dr) * n + (col + dc)];
          if (nv >= v) isMax = false;
          if (nv <= v) isMin = false;
        }
      }
      if (isMax) peaks.push({ gx: col, gz: row, value: v, kind: "peak" });
      else if (isMin) depressions.push({ gx: col, gz: row, value: v, kind: "depression" });
    }
  }

  peaks.sort((a, b) => b.value - a.value);
  depressions.sort((a, b) => a.value - b.value);

  function pickSpaced(source: SpotElevation[], limit: number): SpotElevation[] {
    const picked: SpotElevation[] = [];
    for (const spot of source) {
      if (picked.length >= limit) break;
      const tooClose = picked.some(
        (p) => Math.hypot(p.gx - spot.gx, p.gz - spot.gz) < minSep,
      );
      if (!tooClose) picked.push(spot);
    }
    return picked;
  }

  return [...pickSpaced(peaks, maxPeaks), ...pickSpaced(depressions, maxDepressions)];
}

export function drawUsgsSpotElevations(
  ctx: CanvasRenderingContext2D,
  spots: SpotElevation[],
  gridToScreen: GridToScreen,
): void {
  ctx.font = "8px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const spot of spots) {
    const { sx, sy } = gridToScreen(spot.gx, spot.gz);
    const label = formatContourLabel(spot.value);
    const isPeak = spot.kind === "peak";

    ctx.fillStyle = isPeak ? USGS_NEATLINE : USGS_DEPRESSION_CONTOUR;
    ctx.strokeStyle = "rgba(250, 246, 235, 0.9)";
    ctx.lineWidth = 1.2;
    const size = 4;
    ctx.beginPath();
    if (isPeak) {
      ctx.moveTo(sx, sy - size);
      ctx.lineTo(sx + size, sy + size * 0.6);
      ctx.lineTo(sx - size, sy + size * 0.6);
    } else {
      ctx.moveTo(sx, sy + size);
      ctx.lineTo(sx + size, sy - size * 0.6);
      ctx.lineTo(sx - size, sy - size * 0.6);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = USGS_CONTOUR_LABEL;
    ctx.fillText(label, sx, sy + (isPeak ? -11 : 11));
  }
}

/** Horizontal lake hatch over submerged cells (cartographic hydrography). */
export function drawUsgsHydrographyHatch(
  ctx: CanvasRenderingContext2D,
  values: Float32Array,
  n: number,
  gridToScreen: GridToScreen,
  hydro?: HydrographySliceParams | null,
  blockSize = 4,
): void {
  if (!hydro) return;

  ctx.strokeStyle = "rgba(70, 120, 170, 0.28)";
  ctx.lineWidth = 0.45;

  for (let row = 0; row < n; row += blockSize) {
    for (let col = 0; col < n; col += blockSize) {
      let sum = 0;
      let count = 0;
      for (let dr = 0; dr < blockSize && row + dr < n; dr++) {
        for (let dc = 0; dc < blockSize && col + dc < n; dc++) {
          sum += values[(row + dr) * n + (col + dc)];
          count++;
        }
      }
      const avg = count > 0 ? sum / count : 0;
      if (
        count === 0
        || avg >= HYDRO_DENSITY_THRESHOLD
        || !isHydrographyCellAtSlice(avg, hydro.yLevel, hydro.waterSurfaceY)
      ) {
        continue;
      }

      const { sx, sy } = gridToScreen(col + blockSize / 2, row + blockSize / 2);
      const { sx: sx2 } = gridToScreen(col + blockSize, row + blockSize / 2);
      const w = Math.abs(sx2 - sx) * 1.6;
      if (w < 2) continue;

      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(sx - w / 2, sy + k * 2.5);
        ctx.lineTo(sx + w / 2, sy + k * 2.5);
        ctx.stroke();
      }
    }
  }
}

/** Short cliff hachures on very steep slopes (supplement contours). */
export function drawUsgsSteepSlopeHachures(
  ctx: CanvasRenderingContext2D,
  values: Float32Array,
  n: number,
  gridToScreen: GridToScreen,
  lo: number,
  hi: number,
  step = 4,
  slopeThreshold = 0.14,
): void {
  const span = hi - lo || 1;
  ctx.strokeStyle = "rgba(74, 55, 40, 0.35)";
  ctx.lineWidth = 0.55;
  ctx.lineCap = "round";

  for (let row = 1; row < n - 1; row += step) {
    for (let col = 1; col < n - 1; col += step) {
      const v = values[row * n + col];
      if (v < 0) continue;

      const dx =
        (values[row * n + Math.min(col + 1, n - 1)] - values[row * n + Math.max(col - 1, 0)]) /
        (span * 2);
      const dz =
        (values[Math.min(row + 1, n - 1) * n + col] - values[Math.max(row - 1, 0) * n + col]) /
        (span * 2);
      const slope = Math.hypot(dx, dz);
      if (slope < slopeThreshold) continue;

      const { sx, sy } = gridToScreen(col, row);
      const len = Math.min(7, 3 + slope * 40);
      const nx = -dz / (slope || 1);
      const ny = dx / (slope || 1);
      ctx.beginPath();
      ctx.moveTo(sx - nx * len * 0.5, sy - ny * len * 0.5);
      ctx.lineTo(sx + nx * len * 0.5, sy + ny * len * 0.5);
      ctx.stroke();
    }
  }
}

export interface UsgsTitleBlockInfo {
  contourInterval: number;
  rangeMin: number;
  rangeMax: number;
  yLevel: number;
  gridSpacing: number;
}

/** Quadrangle-style metadata strip inside the neatline. */
export function drawUsgsTitleBlock(
  ctx: CanvasRenderingContext2D,
  displaySize: number,
  info: UsgsTitleBlockInfo,
  inset = 10,
): void {
  const w = 148;
  const h = 42;
  const x = displaySize - inset - w - 4;
  const y = inset + 4;

  ctx.fillStyle = "rgba(250, 246, 235, 0.94)";
  ctx.strokeStyle = "rgba(139, 105, 20, 0.45)";
  ctx.lineWidth = 0.75;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = USGS_CONTOUR_LABEL;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "bold 9px Georgia, 'Times New Roman', serif";
  ctx.fillText("TERRAIN DENSITY SHEET", x + 6, y + 5);
  ctx.font = "8px Georgia, 'Times New Roman', serif";
  ctx.fillText(`Contour interval: ${formatContourLabel(info.contourInterval)}`, x + 6, y + 17);
  ctx.fillText(
    `Extent x/z: ${Math.round(info.rangeMin)}–${Math.round(info.rangeMax)} · Y slice ${info.yLevel}`,
    x + 6,
    y + 28,
  );
}

/** CSS linear-gradient for the topo legend strip. */
export function usgsHypsometricLegendGradient(): string {
  const low = USGS_LOW_ELEV_RGB.join(", ");
  const mid = USGS_MID_ELEV_RGB.join(", ");
  const high = USGS_HIGH_ELEV_RGB.join(", ");
  const peak = "252, 248, 238";
  return `linear-gradient(to right, rgb(${low}), rgb(${mid}), rgb(${high}), rgb(${peak}))`;
}
