import { describe, it, expect } from "vitest";
import {
  extractSurfaceVoxels,
  isAirDensity,
  isSolidDensity,
  SOLID_THRESHOLD,
  type VoxelRegion,
} from "@/utils/voxelExtractor";
import { classifyVoids } from "@/utils/voidClassification";

/**
 * Regression tests for the capped cutaway.
 *
 * The bug these guard against: the old cutaway was a GPU clip plane, which discards
 * fragments at draw time and generates no cap geometry. Since extraction only emits
 * the shell (solid voxels adjacent to air), clipping the top of terrain revealed a
 * HOLLOW interior — the underside of the skin, not solid rock. It read as a paper
 * model rather than a cross-section.
 *
 * Passing a region to extractSurfaceVoxels fixes it by treating the region edge as
 * the air boundary, so voxels against the cut become surface and render solid.
 */

const N = 8;
const YS = 8;

function solidVolume(): Float32Array {
  return new Float32Array(N * N * YS).fill(1);
}

const idx = (x: number, y: number, z: number) => y * N * N + z * N + x;

function positionsOf(voxels: { positions: Float32Array; count: number }): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < voxels.count; i++) {
    set.add(`${voxels.positions[i * 3]},${voxels.positions[i * 3 + 1]},${voxels.positions[i * 3 + 2]}`);
  }
  return set;
}

describe("cutaway capping", () => {
  it("emits solid voxels on the cut face of a fully solid volume", () => {
    // A fully solid block has no interior air, so with no cutaway only the outer
    // boundary is surface. Cutting it in half must expose a NEW solid face.
    const densities = solidVolume();
    const region: VoxelRegion = { x0: 0, x1: 4, y0: 0, y1: YS, z0: 0, z1: N };

    const voxels = extractSurfaceVoxels(densities, N, YS, undefined, undefined, undefined, { keep: region });
    const present = positionsOf(voxels);

    // x = 3 is the cut face (region is [0, 4)). Every voxel on it must be emitted.
    for (let y = 0; y < YS; y++) {
      for (let z = 0; z < N; z++) {
        expect(present.has(`3,${y},${z}`), `missing cap voxel at (3, ${y}, ${z})`).toBe(true);
      }
    }
  });

  it("would emit nothing on the cut face without capping — the original bug", () => {
    // Same solid block, extracted whole. Interior x = 3 is NOT surface, because every
    // neighbour is solid. This is what a clip plane leaves behind: nothing to draw.
    const densities = solidVolume();
    const voxels = extractSurfaceVoxels(densities, N, YS);
    const present = positionsOf(voxels);

    let interiorOnPlane = 0;
    for (let y = 1; y < YS - 1; y++) {
      for (let z = 1; z < N - 1; z++) {
        if (present.has(`3,${y},${z}`)) interiorOnPlane++;
      }
    }
    expect(interiorOnPlane).toBe(0);
  });

  it("leaves default extraction byte-identical when no region is given", () => {
    const densities = solidVolume();
    // Carve a cavity so the volume has interesting interior structure.
    for (let y = 2; y < 6; y++) {
      for (let z = 2; z < 6; z++) {
        for (let x = 2; x < 6; x++) densities[idx(x, y, z)] = -1;
      }
    }

    const withoutRegion = extractSurfaceVoxels(densities, N, YS);
    const withFullRegion = extractSurfaceVoxels(densities, N, YS, undefined, undefined, undefined, {
      keep: { x0: 0, x1: N, y0: 0, y1: YS, z0: 0, z1: N },
    });

    expect(withFullRegion.count).toBe(withoutRegion.count);
    expect(Array.from(withFullRegion.positions)).toEqual(Array.from(withoutRegion.positions));
  });

  it("still reports interior cave walls inside a cutaway", () => {
    // The point of cutting is to SEE the cave, so cave walls must survive the region.
    const densities = solidVolume();
    for (let y = 3; y < 5; y++) {
      for (let z = 3; z < 5; z++) {
        for (let x = 0; x < N; x++) densities[idx(x, y, z)] = -1; // tunnel along x
      }
    }

    const voxels = extractSurfaceVoxels(densities, N, YS, undefined, undefined, undefined, {
      keep: { x0: 0, x1: 4, y0: 0, y1: YS, z0: 0, z1: N },
    });
    const present = positionsOf(voxels);

    // Tunnel roof at y = 5 above the tunnel should be emitted as a wall.
    expect(present.has(`1,5,3`)).toBe(true);
  });

  it("clamps inverted and out-of-range regions instead of throwing", () => {
    const densities = solidVolume();
    expect(() =>
      extractSurfaceVoxels(densities, N, YS, undefined, undefined, undefined, {
        keep: { x0: 6, x1: 2, y0: -5, y1: 999, z0: 0, z1: N },
      }),
    ).not.toThrow();
  });

  it("returns an empty extraction for a degenerate region", () => {
    const densities = solidVolume();
    const voxels = extractSurfaceVoxels(densities, N, YS, undefined, undefined, undefined, {
      keep: { x0: 4, x1: 4, y0: 0, y1: YS, z0: 0, z1: N },
    });
    expect(voxels.count).toBe(0);
  });

  it("uses the documented solid threshold", () => {
    expect(SOLID_THRESHOLD).toBe(0);
  });
});

describe("solid threshold is strict (density > 0)", () => {
  /**
   * Hytale treats density > 0 as solid and density <= 0 as air, verified in
   * TerrainStage$ColumnData.resolve (`dconst_0; dcmpl; ifle <air>`, four times).
   *
   * Exactly-zero is NOT a boundary nitpick: TerrainStage.DEFAULT_BACKGROUND_DENSITY
   * is 0.0, so every voxel falling back to background is air in the real generator.
   * TerraNova previously used `>= 0`, which inverted that default.
   *
   * No test exercised exactly-zero density before, which is how the drift survived.
   * These pin it.
   */

  it("treats exactly-zero density as air, not solid", () => {
    expect(isSolidDensity(0)).toBe(false);
    expect(isAirDensity(0)).toBe(true);
  });

  it("treats the smallest positive density as solid", () => {
    expect(isSolidDensity(Number.MIN_VALUE)).toBe(true);
    expect(isAirDensity(Number.MIN_VALUE)).toBe(false);
  });

  it("treats negatives as air and clear positives as solid", () => {
    expect(isAirDensity(-1)).toBe(true);
    expect(isAirDensity(-Number.MIN_VALUE)).toBe(true);
    expect(isSolidDensity(1)).toBe(true);
  });

  it("is exactly complementary", () => {
    for (const d of [-1, -0.5, -Number.MIN_VALUE, 0, Number.MIN_VALUE, 0.5, 1]) {
      expect(isSolidDensity(d), `density ${d}`).toBe(!isAirDensity(d));
    }
  });

  it("emits no geometry for an all-zero volume — background is air", () => {
    // The whole point: a volume left at DEFAULT_BACKGROUND_DENSITY is empty world,
    // not a solid cube. Under the old `>= 0` rule this produced a full block.
    const densities = new Float32Array(N * N * YS); // zero-filled
    const voxels = extractSurfaceVoxels(densities, N, YS);
    expect(voxels.count).toBe(0);
  });

  it("classifies an all-zero volume as entirely open sky", () => {
    const densities = new Float32Array(N * N * YS);
    const c = classifyVoids(densities, N, YS);
    expect(c.solidCount).toBe(0);
    expect(c.openSkyCount).toBe(N * N * YS);
  });
});

describe("corner cutaway (remove box)", () => {
  // A corner cut leaves an L-shaped remainder, which no single keep-box can express.
  // This is the view that preserves surface context while revealing the interior.
  const CORNER: VoxelRegion = { x0: 4, x1: N, y0: 4, y1: YS, z0: 4, z1: N };

  it("omits voxels inside the removed corner", () => {
    const densities = solidVolume();
    const voxels = extractSurfaceVoxels(densities, N, YS, undefined, undefined, undefined, {
      remove: CORNER,
    });
    const present = positionsOf(voxels);

    for (let y = 4; y < YS; y++) {
      for (let z = 4; z < N; z++) {
        for (let x = 4; x < N; x++) {
          expect(present.has(`${x},${y},${z}`), `removed voxel still drawn at (${x},${y},${z})`).toBe(false);
        }
      }
    }
  });

  it("caps the three faces the corner cut exposes", () => {
    const densities = solidVolume();
    const voxels = extractSurfaceVoxels(densities, N, YS, undefined, undefined, undefined, {
      remove: CORNER,
    });
    const present = positionsOf(voxels);

    // Each face of the notch is the layer of solid immediately outside the removed box.
    expect(present.has(`3,5,5`), "missing -X cap face").toBe(true);
    expect(present.has(`5,3,5`), "missing -Y cap face").toBe(true);
    expect(present.has(`5,5,3`), "missing -Z cap face").toBe(true);
  });

  it("keeps the outer shell outside the notch intact", () => {
    const densities = solidVolume();
    const voxels = extractSurfaceVoxels(densities, N, YS, undefined, undefined, undefined, {
      remove: CORNER,
    });
    const present = positionsOf(voxels);

    // Far corner of the volume, nowhere near the cut, is still outer surface.
    expect(present.has(`0,0,0`)).toBe(true);
  });

  it("composes keep and remove", () => {
    const densities = solidVolume();
    const voxels = extractSurfaceVoxels(densities, N, YS, undefined, undefined, undefined, {
      keep: { x0: 0, x1: 6, y0: 0, y1: YS, z0: 0, z1: N },
      remove: CORNER,
    });
    const present = positionsOf(voxels);

    expect(present.has(`6,2,2`), "voxel outside keep should be dropped").toBe(false);
    expect(present.has(`5,5,5`), "voxel inside remove should be dropped").toBe(false);
    expect(present.has(`5,2,2`), "voxel in the remaining solid should be drawn").toBe(true);
  });
});
