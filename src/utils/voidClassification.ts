import { isAirDensity } from "@/utils/voxelExtractor";

/**
 * Classify air in a density volume by outcome, so the preview can answer the
 * question authors actually have: *did my cave generate, and did it punch through?*
 *
 * Borrowed from WorldPainter's Caves/Tunnels layer, which shades by outcome rather
 * than by presence — lighter where no cave generated, darker where it is fully
 * underground, solid where it breaks the surface. A Hytale density graph has the
 * same three outcomes, and today they are indistinguishable in the preview.
 *
 * Uses the same solid test and 6-neighbour adjacency as voxelExtractor's isSurface,
 * so classification and geometry never disagree about what is solid.
 *
 * Layout: densities[y * n * n + z * n + x]
 */

export const VoidClass = {
  /** Not air. */
  SOLID: 0,
  /** Air with no path to the sky — a sealed cave. */
  ENCLOSED: 1,
  /** Air connected to the sky but with solid above it — a cave mouth or overhang. */
  BREACHING: 2,
  /** Air with open sky directly above — not a cave at all. */
  OPEN_SKY: 3,
} as const;

export type VoidClassValue = (typeof VoidClass)[keyof typeof VoidClass];

export interface VoidClassification {
  /** One VoidClass value per voxel, same layout as the density array. */
  classes: Uint8Array;
  solidCount: number;
  enclosedCount: number;
  breachingCount: number;
  openSkyCount: number;
}

/**
 * Only the TOP face is treated as sky.
 *
 * The side and bottom faces of a preview volume are an artificial crop, not real
 * world boundaries. Flood-filling from them would label any cave that happens to run
 * off the edge of the window as "breaching", which is a rendering artifact rather
 * than a property of the world. Treating them as sealed is the conservative reading:
 * a cave is only reported as breaching when it demonstrably reaches open sky inside
 * the sampled volume.
 */
export function classifyVoids(
  densities: Float32Array,
  resolution: number,
  ySlices: number,
): VoidClassification {
  const n = resolution;
  const ys = ySlices;
  const total = n * n * ys;
  const classes = new Uint8Array(total);

  const isAir = (i: number) => isAirDensity(densities[i]);

  // Pass 1: per-column highest solid voxel. Air above it has open sky overhead;
  // air below it is under something, which is what makes a breach interesting.
  const topSolidY = new Int32Array(n * n).fill(-1);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      for (let y = ys - 1; y >= 0; y--) {
        if (!isAir(y * n * n + z * n + x)) {
          topSolidY[z * n + x] = y;
          break;
        }
      }
    }
  }

  // Pass 2: flood fill air reachable from the top face. Anything reached is connected
  // to the sky; anything left is enclosed.
  const reachable = new Uint8Array(total);
  const stack = new Int32Array(total);
  let sp = 0;

  const topY = ys - 1;
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = topY * n * n + z * n + x;
      if (isAir(i) && reachable[i] === 0) {
        reachable[i] = 1;
        stack[sp++] = i;
      }
    }
  }

  while (sp > 0) {
    const i = stack[--sp];
    const y = (i / (n * n)) | 0;
    const rem = i - y * n * n;
    const z = (rem / n) | 0;
    const x = rem - z * n;

    // 6-neighbour adjacency, matching isSurface.
    if (x > 0) pushIfAir(i - 1);
    if (x < n - 1) pushIfAir(i + 1);
    if (z > 0) pushIfAir(i - n);
    if (z < n - 1) pushIfAir(i + n);
    if (y > 0) pushIfAir(i - n * n);
    if (y < ys - 1) pushIfAir(i + n * n);
  }

  function pushIfAir(j: number): void {
    if (reachable[j] === 0 && isAir(j)) {
      reachable[j] = 1;
      stack[sp++] = j;
    }
  }

  // Pass 3: label.
  let solidCount = 0;
  let enclosedCount = 0;
  let breachingCount = 0;
  let openSkyCount = 0;

  for (let y = 0; y < ys; y++) {
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const i = y * n * n + z * n + x;
        if (!isAir(i)) {
          classes[i] = VoidClass.SOLID;
          solidCount++;
        } else if (reachable[i] === 0) {
          classes[i] = VoidClass.ENCLOSED;
          enclosedCount++;
        } else if (y < topSolidY[z * n + x]) {
          classes[i] = VoidClass.BREACHING;
          breachingCount++;
        } else {
          classes[i] = VoidClass.OPEN_SKY;
          openSkyCount++;
        }
      }
    }
  }

  return { classes, solidCount, enclosedCount, breachingCount, openSkyCount };
}

/**
 * Does this volume contain any cave at all?
 *
 * Useful for the "did my cave actually happen?" case: a graph author who intended
 * caves and gets zero enclosed and zero breaching voxels has produced none, which is
 * otherwise invisible until you go cutting the terrain open looking for them.
 */
export function hasAnyCave(c: VoidClassification): boolean {
  return c.enclosedCount > 0 || c.breachingCount > 0;
}

/* ── Surface tinting by void class ───────────────────────────────── */

/**
 * Palette for the void view. Indices are material ids, so this rides the existing
 * voxel material pipeline unchanged — the mesh builder groups by material index and
 * the legend picks up the names for free.
 */
export const VOID_VIEW_PALETTE = [
  { name: "Open surface", color: "#6f7d8c" },
  { name: "Cave wall (sealed)", color: "#3f7f5f" },
  { name: "Cave mouth (breaches)", color: "#c87a2c" },
] as const;

export const VOID_MATERIAL = {
  OPEN_SURFACE: 0,
  CAVE_WALL: 1,
  CAVE_MOUTH: 2,
} as const;

/**
 * Assign each SOLID voxel a material id describing the air it borders.
 *
 * The mesh only contains solid voxels, so air cannot be tinted directly. What is
 * actually useful is the reverse: which *walls* enclose a sealed cave, and which sit
 * on a breach. That is the question "did it punch through?" rendered in place.
 *
 * Priority is BREACHING > ENCLOSED > OPEN_SKY: a wall touching both a sealed pocket
 * and a breach is part of the mouth, and breaches are the thing being hunted.
 *
 * Returns ids for every voxel in the volume (air included, defaulted to
 * OPEN_SURFACE) so the array can be indexed identically to the density array.
 */
export function buildVoidClassMaterials(
  densities: Float32Array,
  resolution: number,
  ySlices: number,
  classification?: VoidClassification,
): { materialIds: Uint8Array; palette: Array<{ name: string; color: string }>; classification: VoidClassification } {
  const n = resolution;
  const ys = ySlices;
  const c = classification ?? classifyVoids(densities, resolution, ySlices);
  const ids = new Uint8Array(n * n * ys);

  for (let y = 0; y < ys; y++) {
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const i = y * n * n + z * n + x;
        if (c.classes[i] !== VoidClass.SOLID) continue;

        let sawEnclosed = false;
        let sawBreaching = false;

        // Same 6-neighbour adjacency as isSurface, so tinting and geometry agree.
        if (x > 0) inspect(i - 1);
        if (x < n - 1) inspect(i + 1);
        if (z > 0) inspect(i - n);
        if (z < n - 1) inspect(i + n);
        if (y > 0) inspect(i - n * n);
        if (y < ys - 1) inspect(i + n * n);

        ids[i] = sawBreaching
          ? VOID_MATERIAL.CAVE_MOUTH
          : sawEnclosed
            ? VOID_MATERIAL.CAVE_WALL
            : VOID_MATERIAL.OPEN_SURFACE;

        function inspect(j: number): void {
          const cls = c.classes[j];
          if (cls === VoidClass.BREACHING) sawBreaching = true;
          else if (cls === VoidClass.ENCLOSED) sawEnclosed = true;
        }
      }
    }
  }

  return {
    materialIds: ids,
    palette: VOID_VIEW_PALETTE.map((entry) => ({ name: entry.name, color: entry.color })),
    classification: c,
  };
}
