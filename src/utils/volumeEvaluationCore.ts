import type { EvaluationContext } from "./densityEvaluator";

export interface VolumeGridParams {
  resolution: number;
  rangeMin: number;
  rangeMax: number;
  yMin: number;
  yMax: number;
  ySlices: number;
}

export interface VolumeGridResult {
  densities: Float32Array;
  resolution: number;
  ySlices: number;
  minValue: number;
  maxValue: number;
}

/**
 * Evaluate a 3D density grid using a pre-built context (Y-major layout).
 */
export function evaluateDensityGrid3D(
  ctx: EvaluationContext,
  {
    resolution,
    rangeMin,
    rangeMax,
    yMin,
    yMax,
    ySlices,
  }: VolumeGridParams,
  shouldCancel?: () => boolean,
): VolumeGridResult {
  const n = Math.max(1, resolution);
  const ys = Math.max(1, ySlices);
  const densities = new Float32Array(n * n * ys);

  const stepXZ = n > 1 ? (rangeMax - rangeMin) / (n - 1) : 0;
  const stepY = ys > 1 ? (yMax - yMin) / (ys - 1) : 0;
  let minVal = Infinity;
  let maxVal = -Infinity;

  const wxCoords = new Float64Array(n);
  const wzCoords = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const w = rangeMin + i * stepXZ;
    wxCoords[i] = w;
    wzCoords[i] = w;
  }

  const sliceStride = n * n;
  const rootId = ctx.rootId;

  for (let yi = 0; yi < ys; yi++) {
    if (shouldCancel?.()) {
      throw new Error("cancelled");
    }

    const wy = yMin + yi * stepY;
    const yOffset = yi * sliceStride;
    ctx.clearMemo();

    for (let zi = 0; zi < n; zi++) {
      const wz = wzCoords[zi];
      const rowOffset = yOffset + zi * n;

      for (let xi = 0; xi < n; xi++) {
        const val = ctx.evaluate(rootId, wxCoords[xi], wy, wz);
        densities[rowOffset + xi] = val;

        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }
  }

  if (!isFinite(minVal)) minVal = 0;
  if (!isFinite(maxVal)) maxVal = 0;

  return { densities, resolution: n, ySlices: ys, minValue: minVal, maxValue: maxVal };
}

/** Scale Y slices for a progressive step; cap coarse passes for speed. */
export function progressiveYSlices(targetYSlices: number, res: number, targetRes: number): number {
  const scaled = Math.round(targetYSlices * (res / targetRes));
  if (res <= 16) return Math.max(1, Math.min(scaled, 12));
  if (res <= 32) return Math.max(1, Math.min(scaled, 32));
  if (res <= 64) return Math.max(1, Math.min(scaled, 64));
  return Math.max(1, scaled);
}

/** Coarse → mid → target ladder for progressive voxel preview (max 3 worker passes). */
export function buildProgressiveVolumeSteps(
  targetRes: number,
  targetYSlices: number,
  progressive: boolean,
): Array<{ resolution: number; ySlices: number }> {
  if (!progressive || targetRes <= 16) {
    return [{
      resolution: targetRes,
      ySlices: progressiveYSlices(targetYSlices, targetRes, targetRes),
    }];
  }

  const resolutions = [16];
  const mid = Math.min(64, targetRes);
  if (mid > 16 && mid < targetRes) resolutions.push(mid);
  if (resolutions[resolutions.length - 1] !== targetRes) resolutions.push(targetRes);

  return resolutions.map((res) => ({
    resolution: res,
    ySlices: progressiveYSlices(targetYSlices, res, targetRes),
  }));
}
