import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import {
  TEST_FEATURES_PATCHES,
  listMaxInputSourceIds,
  parseTestFeaturesPatchIndex,
  testFeaturesPreviewOrigin,
} from "../testFeaturesGalleryPatches";

describe("testFeaturesGalleryPatches", () => {
  it("catalogs 56 shipped gallery patches", () => {
    expect(TEST_FEATURES_PATCHES).toHaveLength(56);
    expect(TEST_FEATURES_PATCHES[0]?.label).toMatch(/CellValue/);
    expect(TEST_FEATURES_PATCHES[31]?.label).toMatch(/CellNoise2D/);
    expect(TEST_FEATURES_PATCHES[55]?.label).toMatch(/Cube/);
  });

  it("parses patch index from gallery URL", () => {
    expect(parseTestFeaturesPatchIndex("?case=hytale-test-features&patch=32")).toBe(32);
    expect(parseTestFeaturesPatchIndex("?patch=0")).toBeNull();
    expect(parseTestFeaturesPatchIndex("?patch=99")).toBeNull();
  });

  it("centers preview origin on selected patch", () => {
    expect(testFeaturesPreviewOrigin(32, false)).toEqual({ previewOriginX: 150, previewOriginZ: 150 });
    expect(testFeaturesPreviewOrigin(null, true)).toEqual({ previewOriginX: 225, previewOriginZ: 300 });
  });

  it("listMaxInputSourceIds sorts Inputs[i] edges", () => {
    const edges: Edge[] = [
      { id: "e1", source: "b", target: "max", targetHandle: "Inputs[1]" },
      { id: "e0", source: "a", target: "max", targetHandle: "Inputs[0]" },
    ];
    expect(listMaxInputSourceIds("max", edges)).toEqual(["a", "b"]);
  });
});
