import { describe, expect, it } from "vitest";
import { shouldBypassFileCacheForHytaleLayout } from "../layoutCachePolicy";
import type { FileGraphCache } from "@/stores/slices/types";

const biomeWrapper = { Terrain: { Density: { Type: "Constant", Value: 0 } } };

describe("shouldBypassFileCacheForHytaleLayout", () => {
  it("bypasses stale cache when file has Hytale positions but cache used auto-layout", () => {
    const cached = { importLayoutMode: "autolayout" } as FileGraphCache;
    const metadata = {
      comments: {},
      nodeIds: {},
      nodePositions: { "a": { x: 1, y: 2 }, "b": { x: 3, y: 4 }, "c": { x: 5, y: 6 }, "d": { x: 7, y: 8 } },
      hytaleComments: [],
      hytaleGroups: [],
    };
    expect(
      shouldBypassFileCacheForHytaleLayout(biomeWrapper, "/pack/Biomes/Autumn.json", metadata, cached),
    ).toBe(true);
  });

  it("keeps cache when layout mode is already hytale", () => {
    const cached = { importLayoutMode: "hytale" } as FileGraphCache;
    const metadata = {
      comments: {},
      nodeIds: {},
      nodePositions: { "a": { x: 1, y: 2 }, "b": { x: 3, y: 4 }, "c": { x: 5, y: 6 }, "d": { x: 7, y: 8 } },
      hytaleComments: [],
      hytaleGroups: [],
    };
    expect(
      shouldBypassFileCacheForHytaleLayout(biomeWrapper, "/pack/Biomes/Autumn.json", metadata, cached),
    ).toBe(false);
  });
});
