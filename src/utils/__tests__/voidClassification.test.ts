import { describe, it, expect } from "vitest";
import {
  buildVoidClassMaterials,
  classifyVoids,
  hasAnyCave,
  VoidClass,
  VOID_MATERIAL,
} from "@/utils/voidClassification";

/**
 * Synthetic volumes with known answers. Each case isolates one of the three
 * outcomes so a regression points at a specific classification rule.
 */

const N = 8;
const YS = 8;
const idx = (x: number, y: number, z: number) => y * N * N + z * N + x;

/** Ground from y=0 up to (but excluding) `height`, air above. */
function terrain(height: number): Float32Array {
  const d = new Float32Array(N * N * YS);
  for (let y = 0; y < YS; y++) {
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        d[idx(x, y, z)] = y < height ? 1 : -1;
      }
    }
  }
  return d;
}

describe("void classification", () => {
  it("labels air above terrain as open sky, not a cave", () => {
    const d = terrain(4);
    const c = classifyVoids(d, N, YS);

    expect(c.enclosedCount).toBe(0);
    expect(c.breachingCount).toBe(0);
    expect(c.openSkyCount).toBe(N * N * (YS - 4));
    expect(hasAnyCave(c)).toBe(false);
    expect(c.classes[idx(4, 6, 4)]).toBe(VoidClass.OPEN_SKY);
  });

  it("labels a sealed cavity as enclosed", () => {
    const d = terrain(8); // fully solid
    // Hollow out a 2x2x2 pocket well inside the volume.
    for (let y = 2; y < 4; y++) {
      for (let z = 3; z < 5; z++) {
        for (let x = 3; x < 5; x++) d[idx(x, y, z)] = -1;
      }
    }

    const c = classifyVoids(d, N, YS);
    expect(c.enclosedCount).toBe(8);
    expect(c.breachingCount).toBe(0);
    expect(c.openSkyCount).toBe(0);
    expect(hasAnyCave(c)).toBe(true);
    expect(c.classes[idx(3, 2, 3)]).toBe(VoidClass.ENCLOSED);
  });

  it("labels a cavity with a shaft to the sky as breaching", () => {
    const d = terrain(8);
    // Pocket at y=2..3 plus a shaft up through the roof.
    for (let y = 2; y < 4; y++) {
      for (let z = 3; z < 5; z++) {
        for (let x = 3; x < 5; x++) d[idx(x, y, z)] = -1;
      }
    }
    for (let y = 4; y < YS; y++) d[idx(3, y, 3)] = -1;

    const c = classifyVoids(d, N, YS);

    expect(c.enclosedCount).toBe(0);
    expect(c.breachingCount).toBeGreaterThan(0);
    // The pocket is under solid, so it is breaching rather than open sky.
    expect(c.classes[idx(4, 2, 4)]).toBe(VoidClass.BREACHING);
    expect(hasAnyCave(c)).toBe(true);
  });

  it("distinguishes a sealed cave from a breached one in the same volume", () => {
    const d = terrain(8);
    // Sealed pocket on one side.
    d[idx(1, 2, 1)] = -1;

    // Breached chamber on the other: a roofed lateral run at y=2 that reaches the
    // sky through a shaft at its far end. The shaft is deliberately NOT above the
    // chamber — air with clear sky directly overhead is an open pit, not a breach.
    for (let x = 5; x < 8; x++) d[idx(x, 2, 5)] = -1;
    for (let y = 3; y < YS; y++) d[idx(5, y, 5)] = -1;

    const c = classifyVoids(d, N, YS);
    expect(c.classes[idx(1, 2, 1)]).toBe(VoidClass.ENCLOSED);
    // Roofed (solid above at x=6) but connected to the shaft at x=5.
    expect(c.classes[idx(6, 2, 5)]).toBe(VoidClass.BREACHING);
    // Directly under the shaft there is open sky, so it is not a breach.
    expect(c.classes[idx(5, 2, 5)]).toBe(VoidClass.OPEN_SKY);
  });

  it("treats side exits as sealed, not breaching", () => {
    // A tunnel running out the side of the window is a crop artifact, not a breach.
    const d = terrain(8);
    for (let x = 0; x < N; x++) d[idx(x, 2, 4)] = -1;

    const c = classifyVoids(d, N, YS);
    expect(c.breachingCount).toBe(0);
    expect(c.enclosedCount).toBe(N);
    expect(c.classes[idx(0, 2, 4)]).toBe(VoidClass.ENCLOSED);
  });

  it("counts every voxel exactly once", () => {
    const d = terrain(5);
    d[idx(2, 2, 2)] = -1;
    const c = classifyVoids(d, N, YS);
    expect(c.solidCount + c.enclosedCount + c.breachingCount + c.openSkyCount).toBe(N * N * YS);
  });

  it("tags cave walls, cave mouths and open surface distinctly", () => {
    const d = terrain(8);
    // Sealed pocket.
    d[idx(1, 2, 1)] = -1;
    // Breached run: roofed at x=6..7, reaching sky through a shaft at x=5.
    for (let x = 5; x < 8; x++) d[idx(x, 2, 5)] = -1;
    for (let y = 3; y < YS; y++) d[idx(5, y, 5)] = -1;

    const { materialIds, palette, classification } = buildVoidClassMaterials(d, N, YS);

    expect(palette).toHaveLength(3);
    // Wall of the sealed pocket.
    expect(materialIds[idx(1, 1, 1)]).toBe(VOID_MATERIAL.CAVE_WALL);
    // Roof over the breached run is part of the mouth.
    expect(materialIds[idx(6, 3, 5)]).toBe(VOID_MATERIAL.CAVE_MOUTH);
    // Top of the terrain borders open sky only.
    expect(materialIds[idx(0, 7, 0)]).toBe(VOID_MATERIAL.OPEN_SURFACE);
    // Reuses the classification rather than recomputing it.
    expect(classification.enclosedCount).toBeGreaterThan(0);
  });

  it("accepts a precomputed classification", () => {
    const d = terrain(8);
    d[idx(3, 3, 3)] = -1;
    const c = classifyVoids(d, N, YS);
    const a = buildVoidClassMaterials(d, N, YS, c);
    const b = buildVoidClassMaterials(d, N, YS);
    expect(Array.from(a.materialIds)).toEqual(Array.from(b.materialIds));
  });

  it("leaves a caveless volume entirely open surface", () => {
    const d = terrain(4);
    const { materialIds, classification } = buildVoidClassMaterials(d, N, YS);
    expect(hasAnyCave(classification)).toBe(false);
    // Every solid voxel is plain surface — nothing to hunt for.
    for (let i = 0; i < materialIds.length; i++) {
      expect(materialIds[i]).toBe(VOID_MATERIAL.OPEN_SURFACE);
    }
  });

  it("handles an all-air and an all-solid volume", () => {
    const air = new Float32Array(N * N * YS).fill(-1);
    const airC = classifyVoids(air, N, YS);
    expect(airC.openSkyCount).toBe(N * N * YS);
    expect(hasAnyCave(airC)).toBe(false);

    const solid = new Float32Array(N * N * YS).fill(1);
    const solidC = classifyVoids(solid, N, YS);
    expect(solidC.solidCount).toBe(N * N * YS);
    expect(hasAnyCave(solidC)).toBe(false);
  });
});
