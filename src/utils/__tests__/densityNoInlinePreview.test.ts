import { describe, it, expect } from "vitest";
import { densitySkipsInlinePreview, DENSITY_NO_INLINE_PREVIEW_TYPES, getPreviewTargetGuidance } from "../densityNoInlinePreview";

describe("densityNoInlinePreview", () => {
  it("skips CurveMapper and passthrough types", () => {
    expect(densitySkipsInlinePreview("CurveMapper")).toBe(true);
    expect(densitySkipsInlinePreview("Passthrough")).toBe(true);
    expect(densitySkipsInlinePreview("SimplexNoise2D")).toBe(false);
    expect(densitySkipsInlinePreview("BaseHeight")).toBe(false);
  });

  it("includes remappers and caches", () => {
    expect(DENSITY_NO_INLINE_PREVIEW_TYPES.has("SplineFunction")).toBe(true);
    expect(DENSITY_NO_INLINE_PREVIEW_TYPES.has("Cache")).toBe(true);
  });

  it("guides CurveMapper preview target away from heatmap", () => {
    expect(getPreviewTargetGuidance("CurveMapper")).toMatch(/Terrain Out/i);
    expect(getPreviewTargetGuidance("SimplexNoise2D")).toBeNull();
  });
});
