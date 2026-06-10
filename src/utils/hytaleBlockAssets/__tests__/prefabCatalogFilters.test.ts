import { describe, expect, it } from "vitest";
import {
  filterPrefabPaths,
  formatPrefabOptionLabel,
  getPrefabCategory,
  listPrefabCategories,
  listPrefabSubcategories,
  PREFAB_CATEGORY_ALL,
} from "../prefabCatalogFilters";

describe("prefabCatalogFilters", () => {
  const paths = [
    "props/trees/oak_large",
    "props/trees/pine_small",
    "props/rocks/boulder",
    "structures/house",
  ];

  it("derives category from path segments", () => {
    expect(getPrefabCategory("props/trees/oak_large")).toBe("trees");
    expect(getPrefabCategory("structures/house")).toBe("structures");
  });

  it("lists unique sorted categories", () => {
    expect(listPrefabCategories(paths)).toEqual(["rocks", "structures", "trees"]);
  });

  it("filters by query and category", () => {
    const oakOnly = filterPrefabPaths(paths, { query: "oak", category: PREFAB_CATEGORY_ALL });
    expect(oakOnly).toEqual(["props/trees/oak_large"]);

    const trees = filterPrefabPaths(paths, { category: "trees" });
    expect(trees).toHaveLength(2);
  });

  it("lists subfolders within a category", () => {
    const blocksets = [
      "Blocksets/08Rock_Sandstone/Ceiling/Rock_Sandstone_Ceiling_001",
      "Blocksets/08Rock_Sandstone/Floor/Rock_Sandstone_Floor_001",
      "Blocksets/Klops_Basalt/Main/Klops_Basalt_Main_001",
    ];
    expect(listPrefabSubcategories(blocksets, "Blocksets")).toEqual([
      "08Rock_Sandstone",
      "Klops_Basalt",
    ]);
  });

  it("formats dropdown labels without repeating the category", () => {
    const label = formatPrefabOptionLabel(
      "Blocksets/08Rock_Sandstone/Ceiling/Rock_Sandstone_Ceiling_001",
      "Blocksets",
    );
    expect(label).toContain("Ceiling");
    expect(label).not.toMatch(/^Blocksets/);
  });
});
