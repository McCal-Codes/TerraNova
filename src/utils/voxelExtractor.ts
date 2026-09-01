/* ── Types ────────────────────────────────────────────────────────── */

export interface VoxelMaterial {
  name: string;
  color: string;
  roughness?: number;        // 0-1, default 0.8
  metalness?: number;        // 0-1, default 0.0
  emissive?: string;         // hex color
  emissiveIntensity?: number; // default 0.0
}

export interface VoxelData {
  /** Packed x,y,z positions of surface voxels (3 floats per voxel) */
  positions: Float32Array;
  /** Material ID per voxel (indexes into materials array) */
  materialIds: Uint8Array;
  /** Material palette */
  materials: VoxelMaterial[];
  /** Number of surface voxels */
  count: number;
}

/* ── Default palette (no materials loaded) ───────────────────────── */

const DEFAULT_PALETTE: VoxelMaterial[] = [
  { name: "Stone", color: "#808080" },
];

/* ── Solid threshold ─────────────────────────────────────────────── */

/**
 * Density threshold for treating a voxel as solid. The zero-crossing is the surface.
 *
 * Hytale's rule is strict: `density > 0` is solid, `density <= 0` is air.
 *
 * Verified in TerrainStage$ColumnData.resolve, which tests each density four times
 * with the same sequence — `dconst_0; dcmpl; ifle <air>` — so the fall-through
 * (solid) branch is taken only when density is strictly greater than zero.
 *
 * This matters more than a boundary nitpick: TerrainStage.DEFAULT_BACKGROUND_DENSITY
 * is 0.0, so every voxel that falls back to background is AIR in Hytale. Treating
 * zero as solid inverts the default state of the world, and 39 shipped assets also
 * contain an explicit `Constant` node with `Value: 0`.
 *
 * Always compare through isSolidDensity/isAirDensity rather than inlining an
 * operator — that is how the `>=` drift happened in the first place.
 */
export const SOLID_THRESHOLD = 0;

/** True when the voxel is solid: strictly greater than the threshold. */
export function isSolidDensity(density: number): boolean {
  return density > SOLID_THRESHOLD;
}

/** True when the voxel is air: at or below the threshold. */
export function isAirDensity(density: number): boolean {
  return density <= SOLID_THRESHOLD;
}

/** True when at least one voxel in the volume is air (density below solid threshold). */
export function volumeDensityHasAir(densities: Float32Array): boolean {
  for (let i = 0; i < densities.length; i++) {
    if (isAirDensity(densities[i])) return true;
  }
  return false;
}

/* ── Heightmap-smoothed terrain fill ─────────────────────────────── */

/** Number of consecutive air voxels that terminates the bottom-up scan. */
export const GAP_THRESHOLD = 5;

/**
 * More generous density threshold used only for the bottom-up heightmap scan
 * inside smoothTerrainFill(). Note: smoothTerrainFill is no longer in the
 * active voxel pipeline (raw densities go directly to extractSurfaceVoxels),
 * so this constant is effectively unused. Kept for reference.
 */
export const SCAN_THRESHOLD = -0.35;

export interface TerrainFillResult {
  densities: Float32Array;
  /** n×n smoothed heightmap for downstream use (e.g. material resolver). */
  heightmap: Float32Array;
}

/**
 * Build a solid terrain volume by:
 * 1. Bottom-up heightmap with gap detection (finds the connected terrain body)
 * 2. Flood-filling empty columns from neighbors (MAX height)
 * 3. Median filtering the heightmap (3×3, 5 passes) with mirror-pad boundary
 * 4. Average smooth (3×3, 5 passes, no rounding) with mirror-pad boundary
 * 5. Filling below the surface AND clearing ALL above it (no buffer)
 *
 * This guarantees a continuous, watertight terrain surface even when
 * the density field is noisy/sparse near the surface.
 *
 * Returns a TerrainFillResult (does not mutate the input).
 */
export function smoothTerrainFill(
  densities: Float32Array,
  n: number,
  ys: number,
): TerrainFillResult {
  const result = new Float32Array(densities);

  const clamp = (v: number, max: number) => v < 0 ? 0 : v >= max ? max - 1 : v;

  // Step 1: Bottom-up heightmap with gap detection
  // Scan from y=0 upward. Track highestSolid and consecutiveAir.
  // Stop when consecutiveAir >= GAP_THRESHOLD after having found at least one solid.
  // This follows the connected terrain body and ignores floating noise clusters.
  const heightmap = new Float32Array(n * n);
  heightmap.fill(-1);

  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      let highestSolid = -1;
      let consecutiveAir = 0;
      for (let y = 0; y < ys; y++) {
        if (densities[y * n * n + z * n + x] >= SCAN_THRESHOLD) {
          highestSolid = y;
          consecutiveAir = 0;
        } else {
          consecutiveAir++;
          if (consecutiveAir >= GAP_THRESHOLD && highestSolid >= 0) break;
        }
      }
      heightmap[z * n + x] = highestSolid;
    }
  }

  // Step 2: Flood-fill empty columns from neighbors until all are filled.
  // Empty columns inherit the MAX height of their filled neighbors so the
  // terrain surface stays continuous without artificial valleys.
  const filled = new Float32Array(heightmap);
  for (let pass = 0; pass < n; pass++) {
    let changed = false;
    const prev = new Float32Array(filled);
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        if (prev[z * n + x] >= 0) continue;
        let maxH = -1;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dz === 0 && dx === 0) continue;
            const nz = z + dz, nx = x + dx;
            if (nx < 0 || nx >= n || nz < 0 || nz >= n) continue;
            const h = prev[nz * n + nx];
            if (h > maxH) maxH = h;
          }
        }
        if (maxH >= 0) {
          filled[z * n + x] = maxH;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // Step 3: Median filter (3×3, 5 passes) with mirror-pad boundary
  // Median specifically rejects salt-and-pepper outliers while preserving edges.
  // Mirror-pad: edge/corner columns always get 9 samples for consistent smoothing.
  // 5 passes = effective denoising radius of ~5 cells.
  const median = new Float32Array(filled);
  const medBuf = new Float32Array(9);
  for (let pass = 0; pass < 5; pass++) {
    const prev = new Float32Array(median);
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        let bufLen = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const cz = clamp(z + dz, n);
            const cx = clamp(x + dx, n);
            medBuf[bufLen++] = prev[cz * n + cx];
          }
        }
        medBuf.sort();
        median[z * n + x] = medBuf[bufLen >> 1];
      }
    }
  }

  // Step 4: Average smooth (3×3, 5 passes, no rounding) with mirror-pad boundary
  // Removes staircase artifacts from the discrete median filter.
  // No Math.round() — fractional heights propagate across passes for true
  // sub-pixel smoothing. Step 5's Math.round(h) handles final integer conversion.
  // 5 passes = effective smoothing radius of ~5 cells.
  const smoothed = new Float32Array(median);
  for (let pass = 0; pass < 5; pass++) {
    const prev = new Float32Array(smoothed);
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        let sum = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const cz = clamp(z + dz, n);
            const cx = clamp(x + dx, n);
            sum += prev[cz * n + cx];
          }
        }
        smoothed[z * n + x] = sum / 9;
      }
    }
  }

  // Step 5: Fill below AND clear ALL above the smoothed surface (no buffer)
  // - y <= smoothedHeight: fill air voxels as solid (density = 0)
  // - y > smoothedHeight: clear to air (density = -1) — removes floating blocks
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const h = smoothed[z * n + x];
      if (h < 0) continue;
      const hInt = Math.min(Math.round(h), ys - 1);

      // Fill below surface
      for (let y = hInt; y >= 0; y--) {
        const idx = y * n * n + z * n + x;
        if (isAirDensity(result[idx])) {
          result[idx] = 0;
        }
      }

      // Clear ALL above the smoothed surface
      for (let y = hInt + 1; y < ys; y++) {
        const idx = y * n * n + z * n + x;
        if (isSolidDensity(result[idx])) {
          result[idx] = -1;
        }
      }
    }
  }

  return { densities: result, heightmap: smoothed };
}

/**
 * Fill air gaps below the connected terrain body in each column.
 * Preserves caves and overhangs above the highest connected solid (gap detection
 * matches smoothTerrainFill). Prevents see-through holes when viewing from below.
 */
export function fillTerrainColumnBacking(
  densities: Float32Array,
  n: number,
  ys: number,
): Float32Array {
  const result = new Float32Array(densities);

  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      let highestSolid = -1;
      let consecutiveAir = 0;

      for (let y = 0; y < ys; y++) {
        const idx = y * n * n + z * n + x;
        if (isSolidDensity(result[idx])) {
          highestSolid = y;
          consecutiveAir = 0;
        } else {
          consecutiveAir++;
          if (consecutiveAir >= GAP_THRESHOLD && highestSolid >= 0) break;
        }
      }

      if (highestSolid < 0) continue;

      for (let y = 0; y <= highestSolid; y++) {
        const idx = y * n * n + z * n + x;
        if (isAirDensity(result[idx])) {
          result[idx] = 0;
        }
      }
    }
  }

  return result;
}

/* ── Fluid configuration ─────────────────────────────────────────── */

export interface FluidConfig {
  /** Y level below which air becomes fluid (in world coordinates) */
  fluidLevel: number;
  /** Material palette index for fluid voxels */
  fluidMaterialIndex: number;
}

/* ── Cutaway region ──────────────────────────────────────────────── */

/**
 * A sub-box of the volume to extract, in voxel indices.
 * Bounds are inclusive-low, exclusive-high: [x0, x1).
 */
export interface VoxelRegion {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/**
 * How the volume is cut open.
 *
 * Two shapes are needed because they express different views and neither can
 * express the other:
 *
 *   keep   — extract only this box (the "top" preset: keep everything below the
 *            cut level). Its edge becomes an air boundary, so the cut caps.
 *   remove — treat this box as removed. Removing a corner leaves an L-shaped
 *            remainder, which no single keep-box can describe, and the corner cut
 *            is the view that preserves surface context while revealing the interior.
 *
 * Both may be set; a voxel is outside when it falls outside `keep` OR inside `remove`.
 */
export interface CutawayVolume {
  keep?: VoxelRegion;
  remove?: VoxelRegion;
}

/**
 * Clamp a region to the volume and guarantee non-inverted bounds.
 * A degenerate region (zero or negative extent on any axis) yields an empty
 * extraction rather than throwing — callers drag these interactively.
 */
function normalizeRegion(region: VoxelRegion | undefined, n: number, ys: number): VoxelRegion {
  if (!region) return { x0: 0, x1: n, y0: 0, y1: ys, z0: 0, z1: n };
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(v)));
  const x0 = clamp(region.x0, 0, n);
  const x1 = clamp(region.x1, 0, n);
  const y0 = clamp(region.y0, 0, ys);
  const y1 = clamp(region.y1, 0, ys);
  const z0 = clamp(region.z0, 0, n);
  const z1 = clamp(region.z1, 0, n);
  return {
    x0: Math.min(x0, x1),
    x1: Math.max(x0, x1),
    y0: Math.min(y0, y1),
    y1: Math.max(y0, y1),
    z0: Math.min(z0, z1),
    z1: Math.max(z0, z1),
  };
}

/* ── Surface voxel extraction ────────────────────────────────────── */

/**
 * Extract surface voxels from a 3D density volume.
 * A surface voxel is solid (isSolidDensity(density)) with at least one air neighbor.
 *
 * When `fluidConfig` is provided, air voxels at or below the fluid level that have
 * at least one air neighbor above become fluid surface voxels (e.g. lava sea).
 *
 * When `cutaway` is provided, the cut edges are treated as air boundaries. That is
 * what makes a cutaway read as solid rock: the newly exposed faces become
 * boundary-adjacent, so they qualify as surface and get emitted. Without it, clipping
 * a shell-only extraction reveals a hollow interior.
 *
 * Layout: densities[y * n * n + z * n + x]
 */
export function extractSurfaceVoxels(
  densities: Float32Array,
  resolution: number,
  ySlices: number,
  materialIds?: Uint8Array,
  palette?: VoxelMaterial[],
  fluidConfig?: FluidConfig,
  cutaway?: CutawayVolume,
): VoxelData {
  const n = resolution;
  const ys = ySlices;
  const materials = palette ?? DEFAULT_PALETTE;
  const box = normalizeRegion(cutaway?.keep, n, ys);
  const cut = cutaway?.remove ? normalizeRegion(cutaway.remove, n, ys) : undefined;
  const removed = (x: number, y: number, z: number): boolean =>
    cut !== undefined &&
    x >= cut.x0 && x < cut.x1 &&
    y >= cut.y0 && y < cut.y1 &&
    z >= cut.z0 && z < cut.z1;

  // First pass: count surface voxels (solid surfaces + fluid surfaces)
  let count = 0;
  for (let y = box.y0; y < box.y1; y++) {
    const yOff = y * n * n;
    for (let z = box.z0; z < box.z1; z++) {
      for (let x = box.x0; x < box.x1; x++) {
        const idx = yOff + z * n + x;
        if (removed(x, y, z)) continue;
        if (isSolidDensity(densities[idx])) {
          // Solid voxel — check if it's a surface
          if (isSurface(densities, x, y, z, n, box, removed)) {
            count++;
          }
        } else if (fluidConfig && y <= fluidConfig.fluidLevel) {
          // Air voxel below fluid level — render as fluid surface if exposed
          if (isFluidSurface(densities, x, y, z, n, ys, fluidConfig.fluidLevel)) {
            count++;
          }
        }
      }
    }
  }

  // Second pass: fill positions and material IDs
  const positions = new Float32Array(count * 3);
  const outMaterialIds = new Uint8Array(count);
  let vi = 0;

  for (let y = box.y0; y < box.y1; y++) {
    const yOff = y * n * n;
    for (let z = box.z0; z < box.z1; z++) {
      for (let x = box.x0; x < box.x1; x++) {
        const idx = yOff + z * n + x;
        if (removed(x, y, z)) continue;
        if (isSolidDensity(densities[idx])) {
          if (isSurface(densities, x, y, z, n, box, removed)) {
            positions[vi * 3] = x;
            positions[vi * 3 + 1] = y;
            positions[vi * 3 + 2] = z;
            outMaterialIds[vi] = materialIds ? materialIds[idx] : 0;
            vi++;
          }
        } else if (fluidConfig && y <= fluidConfig.fluidLevel) {
          if (isFluidSurface(densities, x, y, z, n, ys, fluidConfig.fluidLevel)) {
            positions[vi * 3] = x;
            positions[vi * 3 + 1] = y;
            positions[vi * 3 + 2] = z;
            outMaterialIds[vi] = fluidConfig.fluidMaterialIndex;
            vi++;
          }
        }
      }
    }
  }

  return { positions, materialIds: outMaterialIds, materials, count };
}

function isSurface(
  densities: Float32Array,
  x: number, y: number, z: number,
  n: number, box: VoxelRegion,
  removed: (x: number, y: number, z: number) => boolean,
): boolean {
  // Check 6 neighbors
  const dirs = [
    [-1, 0, 0], [1, 0, 0],
    [0, -1, 0], [0, 1, 0],
    [0, 0, -1], [0, 0, 1],
  ] as const;

  for (const [dx, dy, dz] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    const nz = z + dz;

    // Outside the extracted region = air. With no cutaway the region is the whole
    // volume, so this is the original "out of bounds = air" rule. With a cutaway it
    // is also what caps the cut: voxels against the cut plane become surface and
    // render as solid rock instead of leaving a hollow shell.
    if (nx < box.x0 || nx >= box.x1 || ny < box.y0 || ny >= box.y1 || nz < box.z0 || nz >= box.z1) {
      return true;
    }

    // A neighbour inside the removed box is air for the same reason: it is no
    // longer being drawn, so this face is exposed and must be capped.
    if (removed(nx, ny, nz)) {
      return true;
    }

    const nIdx = ny * n * n + nz * n + nx;
    if (isAirDensity(densities[nIdx])) {
      return true;
    }
  }

  return false;
}

/**
 * Check if an air voxel below the fluid level is a fluid surface voxel.
 * A fluid surface voxel is air, at or below the fluid level, and has at least one
 * neighbor that is either above the fluid level or is solid (creates the surface boundary).
 */
function isFluidSurface(
  densities: Float32Array,
  x: number, y: number, z: number,
  n: number, ys: number,
  fluidLevel: number,
): boolean {
  const dirs = [
    [-1, 0, 0], [1, 0, 0],
    [0, -1, 0], [0, 1, 0],
    [0, 0, -1], [0, 0, 1],
  ] as const;

  for (const [dx, dy, dz] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    const nz = z + dz;

    // Out of bounds = exposed
    if (nx < 0 || nx >= n || ny < 0 || ny >= ys || nz < 0 || nz >= n) {
      return true;
    }

    // Neighbor above fluid level and also air = exposed surface
    if (ny > fluidLevel && isAirDensity(densities[ny * n * n + nz * n + nx])) {
      return true;
    }

    // Neighbor is solid = fluid touches terrain
    if (isSolidDensity(densities[ny * n * n + nz * n + nx])) {
      return true;
    }
  }

  return false;
}
