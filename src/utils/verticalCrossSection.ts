export interface VerticalCrossSectionSample {
  distance: number;
  worldY: number;
  value: number;
  solid: boolean;
}

export interface VerticalCrossSectionGrid {
  distances: number[];
  worldYs: number[];
  values: Float32Array;
  width: number;
  height: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Bilinear sample on XZ slice at fixed world Y from Y-major volume layout. */
function sampleXZAtY(
  densities: Float32Array,
  n: number,
  ys: number,
  yMin: number,
  yMax: number,
  worldX: number,
  worldZ: number,
  worldY: number,
  rangeMin: number,
  rangeMax: number,
): number {
  const stepXZ = n > 1 ? (rangeMax - rangeMin) / (n - 1) : 0;
  const stepY = ys > 1 ? (yMax - yMin) / (ys - 1) : 0;

  const gridX = stepXZ > 0 ? (worldX - rangeMin) / stepXZ : 0;
  const gridZ = stepXZ > 0 ? (worldZ - rangeMin) / stepXZ : 0;
  const gridY = stepY > 0 ? (worldY - yMin) / stepY : 0;

  const x0 = Math.floor(gridX);
  const z0 = Math.floor(gridZ);
  const y0 = Math.floor(gridY);
  const x1 = Math.min(x0 + 1, n - 1);
  const z1 = Math.min(z0 + 1, n - 1);
  const y1 = Math.min(y0 + 1, ys - 1);

  const fx = gridX - x0;
  const fz = gridZ - z0;
  const fy = gridY - y0;

  const cx0 = Math.max(0, Math.min(n - 1, x0));
  const cz0 = Math.max(0, Math.min(n - 1, z0));
  const cy0 = Math.max(0, Math.min(ys - 1, y0));

  const idx = (yi: number, zi: number, xi: number) => yi * n * n + zi * n + xi;

  const v000 = densities[idx(cy0, cz0, cx0)];
  const v100 = densities[idx(cy0, cz0, x1)];
  const v010 = densities[idx(cy0, z1, cx0)];
  const v110 = densities[idx(cy0, z1, x1)];
  const v001 = densities[idx(y1, cz0, cx0)];
  const v101 = densities[idx(y1, cz0, x1)];
  const v011 = densities[idx(y1, z1, cx0)];
  const v111 = densities[idx(y1, z1, x1)];

  const v00 = lerp(v000, v100, fx);
  const v10 = lerp(v010, v110, fx);
  const v01 = lerp(v001, v101, fx);
  const v11 = lerp(v011, v111, fx);
  const v0 = lerp(v00, v10, fz);
  const v1 = lerp(v01, v11, fz);
  return lerp(v0, v1, fy);
}

/**
 * Sample density along a vertical wall following an XZ line through a 3D volume.
 * Layout: densities[y * n * n + z * n + x]
 */
export function sampleVerticalCrossSection(
  densities: Float32Array,
  resolution: number,
  ySlices: number,
  rangeMin: number,
  rangeMax: number,
  yMin: number,
  yMax: number,
  start: { x: number; z: number },
  end: { x: number; z: number },
  distanceSamples = 64,
  ySamples?: number,
): VerticalCrossSectionGrid {
  const n = resolution;
  const ys = ySlices;
  const height = ySamples ?? ys;
  const width = Math.max(2, distanceSamples);

  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const worldLength = Math.sqrt(dx * dx + dz * dz) || 1;

  const distances: number[] = [];
  const worldYs: number[] = [];
  const values = new Float32Array(width * height);

  for (let yi = 0; yi < height; yi++) {
    const wy = height > 1
      ? yMin + (yi / (height - 1)) * (yMax - yMin)
      : yMin;
    worldYs.push(wy);
  }

  for (let di = 0; di < width; di++) {
    const t = di / (width - 1);
    const wx = start.x + t * dx;
    const wz = start.z + t * dz;
    distances.push(t * worldLength);

    for (let yi = 0; yi < height; yi++) {
      const wy = worldYs[yi];
      values[yi * width + di] = sampleXZAtY(
        densities, n, ys, yMin, yMax, wx, wz, wy, rangeMin, rangeMax,
      );
    }
  }

  return { distances, worldYs, values, width, height };
}

export function verticalCrossSectionToSamples(grid: VerticalCrossSectionGrid): VerticalCrossSectionSample[] {
  const out: VerticalCrossSectionSample[] = [];
  for (let yi = 0; yi < grid.height; yi++) {
    for (let di = 0; di < grid.width; di++) {
      const v = grid.values[yi * grid.width + di];
      out.push({
        distance: grid.distances[di],
        worldY: grid.worldYs[yi] ?? 0,
        value: v,
        solid: v >= 0,
      });
    }
  }
  return out;
}
