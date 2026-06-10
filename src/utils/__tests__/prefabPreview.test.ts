import { describe, expect, it } from "vitest";
import { buildPrefabPreviewMesh } from "../hytaleBlockAssets/buildPrefabPreviewMesh";
import {
  extractPrefabPathFromFields,
  normalizePrefabRelativePath,
} from "../hytaleBlockAssets/extractPrefabPath";
import type { PrefabJson } from "../hytaleBlockAssets/types";

describe("extractPrefabPathFromFields", () => {
  it("reads direct Path field", () => {
    expect(extractPrefabPathFromFields({ Path: "Trees/Oak_Small" })).toBe("Trees/Oak_Small");
  });

  it("reads first WeightedPrefabPaths entry", () => {
    expect(
      extractPrefabPathFromFields({
        WeightedPrefabPaths: [{ Path: "Ruins/Tower", Weight: 1 }],
      }),
    ).toBe("Ruins/Tower");
  });

  it("returns null when no path is set", () => {
    expect(extractPrefabPathFromFields({})).toBeNull();
  });
});

describe("normalizePrefabRelativePath", () => {
  it("strips leading slash and .prefab.json suffix", () => {
    expect(normalizePrefabRelativePath("/Trees/Oak.prefab.json")).toBe("Trees/Oak");
  });
});

describe("buildPrefabPreviewMesh", () => {
  const prefab: PrefabJson = {
    blocks: [
      { x: 0, y: 0, z: 0, name: "Rock_Stone" },
      { x: 1, y: 0, z: 0, name: "Rock_Stone" },
    ],
  };

  it("builds geometry for prefab blocks", () => {
    const mesh = buildPrefabPreviewMesh(prefab, {});
    expect(mesh.blockCount).toBe(2);
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.radius).toBeGreaterThan(0);
  });

  it("uses sampled block colors when provided", () => {
    const mesh = buildPrefabPreviewMesh(prefab, {}, {
      blockColors: { Rock_Stone: [0.2, 0.4, 0.8] },
    });
    expect(mesh.colors[0]).toBeCloseTo(0.2);
    expect(mesh.colors[1]).toBeCloseTo(0.4);
    expect(mesh.colors[2]).toBeCloseTo(0.8);
  });

  it("marks truncation when render cap exceeded", () => {
    const huge: PrefabJson = {
      blocks: Array.from({ length: 20 }, (_, i) => ({
        x: i,
        y: 0,
        z: 0,
        name: "Rock_Stone",
      })),
    };
    const mesh = buildPrefabPreviewMesh(huge, {}, { renderCap: 5 });
    expect(mesh.truncated).toBe(true);
    expect(mesh.renderedBlocks).toBe(5);
  });
});
