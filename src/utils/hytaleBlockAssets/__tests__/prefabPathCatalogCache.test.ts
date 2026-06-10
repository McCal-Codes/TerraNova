import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPrefabPathCatalog,
  invalidatePrefabPathCatalog,
  peekPrefabPathCatalog,
} from "../prefabPathCatalogCache";

vi.mock("../listHytalePrefabPaths", () => ({
  listHytalePrefabPaths: vi.fn(async (projectRoot: string | null) => ({
    paths: projectRoot ? [`${projectRoot}/A`, `${projectRoot}/B`] : ["Cached/A"],
    truncated: false,
    error: null,
  })),
}));

describe("prefabPathCatalogCache", () => {
  beforeEach(() => {
    invalidatePrefabPathCatalog();
    vi.clearAllMocks();
  });

  it("deduplicates concurrent catalog loads per project root", async () => {
    const { listHytalePrefabPaths } = await import("../listHytalePrefabPaths");
    const [a, b] = await Promise.all([
      getPrefabPathCatalog("/pack"),
      getPrefabPathCatalog("/pack"),
    ]);
    expect(a.paths).toEqual(["/pack/A", "/pack/B"]);
    expect(b).toEqual(a);
    expect(listHytalePrefabPaths).toHaveBeenCalledTimes(1);
    expect(peekPrefabPathCatalog("/pack")?.paths).toEqual(a.paths);
  });
});
