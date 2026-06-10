import { describe, it, expect } from "vitest";
import { normalizePrefabRelativePath } from "../extractPrefabPath";

describe("prefab path normalization for catalog", () => {
  it("strips .prefab.json suffix from catalog entries", () => {
    expect(normalizePrefabRelativePath("Trees/Oak.prefab.json")).toBe("Trees/Oak");
  });

  it("normalizes backslashes and leading slashes", () => {
    expect(normalizePrefabRelativePath("\\Grass\\Patch_01")).toBe("Grass/Patch_01");
    expect(normalizePrefabRelativePath("/Ruins/Tower")).toBe("Ruins/Tower");
  });
});
