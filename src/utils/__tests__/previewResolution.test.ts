import { describe, expect, it } from "vitest";
import {
  clamp2dPreviewResolution,
  buildDensityPreviewEvalSteps,
  resolve2dPreviewResolutionForZoom,
} from "@/utils/previewResolution";

describe("previewResolution", () => {
  it("caps manual 2D preview at 64", () => {
    expect(clamp2dPreviewResolution(512)).toBe(64);
    expect(clamp2dPreviewResolution(64)).toBe(64);
    expect(clamp2dPreviewResolution(48)).toBe(48);
    expect(clamp2dPreviewResolution(8)).toBe(16);
  });

  it("scales eval resolution with visual zoom", () => {
    expect(resolve2dPreviewResolutionForZoom(32, 1)).toBe(32);
    expect(resolve2dPreviewResolutionForZoom(32, 2)).toBe(64);
    expect(resolve2dPreviewResolutionForZoom(32, 0.5)).toBe(16);
    expect(resolve2dPreviewResolutionForZoom(64, 4)).toBe(256);
    expect(resolve2dPreviewResolutionForZoom(64, 8)).toBe(256);
  });

  it("builds 2D ladder as coarse then target without duplicate final pass", () => {
    expect(buildDensityPreviewEvalSteps("2d", 64)).toEqual([16, 32, 64]);
    expect(buildDensityPreviewEvalSteps("2d", 32)).toEqual([16, 32]);
    expect(buildDensityPreviewEvalSteps("2d", 16)).toEqual([16]);
    expect(buildDensityPreviewEvalSteps("2d", 256)).toEqual([16, 32, 64, 128, 256]);
  });

  it("builds 3D ladder as coarse then target (same as 2D)", () => {
    expect(buildDensityPreviewEvalSteps("3d", 128)).toEqual([16, 128]);
    expect(buildDensityPreviewEvalSteps("3d", 64)).toEqual([16, 64]);
  });
});
