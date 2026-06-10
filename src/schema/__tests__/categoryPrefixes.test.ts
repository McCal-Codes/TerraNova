import { describe, it, expect } from "vitest";
import {
  CATEGORY_TO_EDITOR_PREFIX,
  expectedBundleCategory,
  FIELD_CATEGORY_PREFIX,
  resolveEditorTypeKey,
  stripEditorPrefix,
  toBundleTypeKey,
  toEditorTypeKey,
} from "@/schema/categoryPrefixes";
import { AssetCategory } from "@/schema/types";

describe("categoryPrefixes", () => {
  it("round-trips Material:Constant editor ↔ bundle keys", () => {
    expect(toBundleTypeKey("Material:Constant")).toBe("MaterialProvider:Constant");
    expect(toEditorTypeKey("MaterialProvider:Constant")).toBe("Material:Constant");
    expect(stripEditorPrefix("Material:Constant")).toBe("Constant");
    expect(resolveEditorTypeKey("Constant", "Material")).toBe("Material:Constant");
    expect(expectedBundleCategory("Material:Constant")).toBe("MaterialProvider");
  });

  it("maps density bare keys to Density category", () => {
    expect(expectedBundleCategory("SimplexNoise2D")).toBe("Density");
    expect(CATEGORY_TO_EDITOR_PREFIX[AssetCategory.Density]).toBeUndefined();
  });

  it("maps nested Material field to Material editor prefix", () => {
    expect(FIELD_CATEGORY_PREFIX.Material).toBe("Material");
    expect(FIELD_CATEGORY_PREFIX.Layers).toBe("Layer");
  });
});
