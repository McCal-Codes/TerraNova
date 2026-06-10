import { marchingSquaresZeroContour } from "./marchingSquaresZeroContour";
import type { ContourSegment } from "./marchingSquaresZeroContour";

/**
 * Y-major volume layout from evaluateDensityVolume:
 * densities[yi * n * n + zi * n + xi]
 */
export function extractVolumeXZSlice(
  densities: Float32Array,
  resolution: number,
  ySlices: number,
  yMin: number,
  yMax: number,
  worldY: number,
): Float32Array {
  const n = resolution;
  const ys = Math.max(1, ySlices);
  const stepY = ys > 1 ? (yMax - yMin) / (ys - 1) : 0;
  let yi = stepY > 0 ? Math.round((worldY - yMin) / stepY) : 0;
  yi = Math.max(0, Math.min(ys - 1, yi));

  const slice = new Float32Array(n * n);
  const yOff = yi * n * n;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      slice[row * n + col] = densities[yOff + row * n + col];
    }
  }
  return slice;
}

/** Marching-squares zero contour on the XZ plane at world Y through a 3D density volume. */
export function marchingSquaresZeroContourAtWorldY(
  densities: Float32Array,
  resolution: number,
  ySlices: number,
  yMin: number,
  yMax: number,
  worldY: number,
): ContourSegment[] {
  const n = resolution;
  const slice = extractVolumeXZSlice(densities, n, ySlices, yMin, yMax, worldY);
  return marchingSquaresZeroContour(slice, n);
}
