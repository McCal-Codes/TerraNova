import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { hytaleToInternalBiome } from "@/utils/hytaleToInternal";
import { listHytaleBiomePropLayers } from "@/utils/propSources/hytaleBiomePropLayers";

const FIXTURES = [
  {
    label: "Basic",
    path: "templates/hytale-release/HytaleGenerator/Biomes/Basic.json",
    minLayers: 1,
    expectPropDistribution: true,
  },
  {
    label: "Boreal1 Henges",
    path: "templates/hytale-release/HytaleGenerator/Biomes/Boreal1/Boreal1_Henges.json",
    minLayers: 1,
    expectPropDistribution: true,
  },
];

describe("listHytaleBiomePropLayers", () => {
  it.each(FIXTURES.filter((f) => existsSync(join(process.cwd(), f.path))))(
    "$label summarizes prop layers",
    ({ path, minLayers, expectPropDistribution }) => {
      const raw = JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as Record<string, unknown>;
      const wrapper = hytaleToInternalBiome(raw).wrapper;
      const layers = listHytaleBiomePropLayers(wrapper);
      expect(layers.length).toBeGreaterThanOrEqual(minLayers);
      if (expectPropDistribution) {
        expect(layers[0]?.rootType).toContain("PropDistribution");
      }
    },
  );

  it("returns empty array when Props is missing", () => {
    expect(listHytaleBiomePropLayers({ Name: "Empty" })).toEqual([]);
  });
});
