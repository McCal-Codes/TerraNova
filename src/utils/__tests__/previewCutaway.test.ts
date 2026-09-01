import { describe, it, expect } from "vitest";
import {
  buildCutawayVolume,
  isCutawayPreset,
  presetSupportsClipPlanePreview,
  worldYToSlice,
  type VoxelVolumeDims,
} from "@/utils/previewCutaway";
import { extractSurfaceVoxels } from "@/utils/voxelExtractor";

const DIMS: VoxelVolumeDims = {
  resolution: 16,
  ySlices: 16,
  voxelYMin: 0,
  voxelYMax: 320,
};

describe("worldYToSlice", () => {
  it("maps the world range onto slice indices", () => {
    expect(worldYToSlice(0, DIMS)).toBe(0);
    expect(worldYToSlice(160, DIMS)).toBe(8);
    expect(worldYToSlice(320, DIMS)).toBe(16);
  });

  it("clamps outside the range rather than producing invalid boxes", () => {
    expect(worldYToSlice(-1000, DIMS)).toBe(0);
    expect(worldYToSlice(99999, DIMS)).toBe(16);
  });

  it("survives a degenerate Y range", () => {
    expect(worldYToSlice(50, { ...DIMS, voxelYMin: 100, voxelYMax: 100 })).toBe(0);
  });
});

describe("buildCutawayVolume", () => {
  it("returns undefined for off, so callers can skip re-extraction", () => {
    expect(buildCutawayVolume("off", 160, DIMS)).toBeUndefined();
  });

  it("top keeps everything below the cut", () => {
    const cut = buildCutawayVolume("top", 160, DIMS);
    expect(cut?.keep).toEqual({ x0: 0, x1: 16, y0: 0, y1: 8, z0: 0, z1: 16 });
    expect(cut?.remove).toBeUndefined();
  });

  it("corner removes one quadrant only above the cut", () => {
    const cut = buildCutawayVolume("corner", 160, DIMS);
    expect(cut?.remove).toEqual({ x0: 8, x1: 16, y0: 8, y1: 16, z0: 8, z1: 16 });
    expect(cut?.keep).toBeUndefined();
  });

  it("corner leaves the ground below the cut intact", () => {
    // The notch must not extend below the cut level, or you look straight through
    // the model instead of down into it.
    const cut = buildCutawayVolume("corner", 200, DIMS);
    expect(cut?.remove?.y0).toBe(worldYToSlice(200, DIMS));
    expect(cut?.remove?.y1).toBe(DIMS.ySlices);
  });
});

describe("clip-plane preview policy", () => {
  it("only previews the top preset on the GPU", () => {
    // Corner would need clipIntersection, which makes three.js reinitialise materials
    // every frame. It relies on re-extraction instead.
    expect(presetSupportsClipPlanePreview("top")).toBe(true);
    expect(presetSupportsClipPlanePreview("corner")).toBe(false);
    expect(presetSupportsClipPlanePreview("off")).toBe(false);
  });
});

describe("isCutawayPreset", () => {
  it("accepts known presets and rejects anything else", () => {
    expect(isCutawayPreset("top")).toBe(true);
    expect(isCutawayPreset("corner")).toBe(true);
    expect(isCutawayPreset("off")).toBe(true);
    // Guards against a stale localStorage value becoming an invalid state.
    expect(isCutawayPreset("quadrant")).toBe(false);
    expect(isCutawayPreset(undefined)).toBe(false);
    expect(isCutawayPreset(3)).toBe(false);
  });
});

describe("presets produce usable extractions end to end", () => {
  const N = 16;
  const YS = 16;
  const solid = () => new Float32Array(N * N * YS).fill(1);

  function countAt(densities: Float32Array, preset: "top" | "corner") {
    const cut = buildCutawayVolume(preset, 160, DIMS)!;
    return extractSurfaceVoxels(densities, N, YS, undefined, undefined, undefined, cut).count;
  }

  it("both presets emit geometry on a solid block", () => {
    const d = solid();
    expect(countAt(d, "top")).toBeGreaterThan(0);
    expect(countAt(d, "corner")).toBeGreaterThan(0);
  });

  it("corner removes less than top at the same level", () => {
    // A quadrant is a quarter of the volume above the cut; top removes all of it.
    // So the corner cut must leave more geometry standing.
    const d = solid();
    expect(countAt(d, "corner")).toBeGreaterThan(countAt(d, "top"));
  });
});
