import { describe, expect, it } from "vitest";
import {
  filterPrefabPaths,
  getPrefabCategory,
  listPrefabCategories,
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
});
