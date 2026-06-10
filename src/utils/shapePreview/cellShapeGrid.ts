import { hashSeed, mulberry32 } from "../density/prng";
import {
  lastVoronoiCellHash,
  lastVoronoiDistances,
  voronoiNoise2D,
  voronoiNoise3D,
} from "../density/voronoiNoise";

export interface CellShapeGridParams {
  /** Uniform scale (PositionsCellNoise). */
  scale?: number;
  /** Per-axis scale (CellNoise2D / VoronoiNoise2D). */
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  seed?: string | number;
  jitter?: number;
  /** FNL cellular return type (Distance2Div, etc.). */
  cellType?: string;
  returnType?: string;
  distanceFunction?: string;
  /** When true, sample 3D voronoi at (sx, yNorm, sz) instead of 2D. */
  use3D?: boolean;
  yLevel?: number;
}

export interface CellShapeGridResult {
  resolution: number;
  cellIds: Uint32Array;
  wallDist: Float32Array;
  edgeMask: Uint8Array;
}

function pcnJitter(fields: CellShapeGridParams): number {
  return Number(fields.jitter ?? 0.5) * 2.0;
}

export function evaluateCellShapeGrid(
  rangeMin: number,
  rangeMax: number,
  resolution: number,
  fields: CellShapeGridParams,
): CellShapeGridResult {
  const uniformScale = Number(fields.scale ?? 1.0);
  const scaleX = Number(fields.scaleX ?? uniformScale) || 1;
  const scaleY = Number(fields.scaleY ?? uniformScale) || 1;
  const scaleZ = Number(fields.scaleZ ?? uniformScale) || 1;
  const seed = hashSeed(fields.seed);
  const jitter = pcnJitter(fields);
  const cellType = fields.cellType ?? fields.returnType ?? "Distance";
  const returnType = fields.returnType ?? cellType;
  const distFn = fields.distanceFunction ?? "Euclidean";
  const use3D = fields.use3D ?? false;
  const yLevel = fields.yLevel ?? 0;

  const rng = mulberry32(seed);
  const n = resolution;
  const cellIds = new Uint32Array(n * n);
  const wallDist = new Float32Array(n * n);
  const worldRange = rangeMax - rangeMin;

  if (use3D) {
    const noise = voronoiNoise3D(rng, cellType, jitter, returnType, distFn, seed);
    const sy = scaleY !== 0 ? yLevel / scaleY : yLevel;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const wx = rangeMin + ((col + 0.5) / n) * worldRange;
        const wz = rangeMin + ((row + 0.5) / n) * worldRange;
        const sx = scaleX !== 0 ? wx / scaleX : wx;
        const sz = scaleZ !== 0 ? wz / scaleZ : wz;
        noise(sx, sy, sz);
        const idx = row * n + col;
        cellIds[idx] = lastVoronoiCellHash >>> 0;
        wallDist[idx] = Math.max(0, (lastVoronoiDistances.d2 - lastVoronoiDistances.d1) / 2.0);
      }
    }
  } else {
    const noise = voronoiNoise2D(rng, cellType, jitter, returnType, distFn, seed);
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const wx = rangeMin + ((col + 0.5) / n) * worldRange;
        const wz = rangeMin + ((row + 0.5) / n) * worldRange;
        const sx = scaleX !== 0 ? wx / scaleX : wx;
        const sz = scaleZ !== 0 ? wz / scaleZ : wz;
        noise(sx, sz);
        const idx = row * n + col;
        cellIds[idx] = lastVoronoiCellHash >>> 0;
        wallDist[idx] = Math.max(0, (lastVoronoiDistances.d2 - lastVoronoiDistances.d1) / 2.0);
      }
    }
  }

  const edgeMask = new Uint8Array(n * n);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const idx = row * n + col;
      const id = cellIds[idx];
      let edge = false;
      if (col > 0 && cellIds[idx - 1] !== id) edge = true;
      if (col < n - 1 && cellIds[idx + 1] !== id) edge = true;
      if (row > 0 && cellIds[idx - n] !== id) edge = true;
      if (row < n - 1 && cellIds[idx + n] !== id) edge = true;
      if (edge) edgeMask[idx] = 1;
    }
  }

  return { resolution: n, cellIds, wallDist, edgeMask };
}

/** Union cell walls / min wall distance from multiple PCN layers (e.g. Max combiner). */
export function mergeCellShapeGrids(grids: CellShapeGridResult[]): CellShapeGridResult | null {
  if (grids.length === 0) return null;
  const base = grids[0]!;
  if (grids.length === 1) return base;

  const merged: CellShapeGridResult = {
    resolution: base.resolution,
    cellIds: base.cellIds,
    wallDist: new Float32Array(base.wallDist),
    edgeMask: new Uint8Array(base.edgeMask),
  };
  merged.wallDist.set(base.wallDist);
  merged.edgeMask.set(base.edgeMask);

  for (let g = 1; g < grids.length; g++) {
    const grid = grids[g]!;
    if (grid.resolution !== base.resolution) continue;
    for (let i = 0; i < merged.edgeMask.length; i++) {
      merged.edgeMask[i] |= grid.edgeMask[i];
      merged.wallDist[i] = Math.min(merged.wallDist[i], grid.wallDist[i]);
    }
  }

  return merged;
}
