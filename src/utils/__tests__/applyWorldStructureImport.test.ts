import { describe, it, expect } from "vitest";
import { extractNoiseRangeFromWorldStructure } from "../applyWorldStructureImport";

describe("applyWorldStructureImport", () => {
  it("extracts biome ranges and config from NoiseRange JSON", () => {
    const result = extractNoiseRangeFromWorldStructure({
      Type: "NoiseRange",
      DefaultBiome: "Plains",
      DefaultTransitionDistance: 48,
      MaxBiomeEdgeDistance: 64,
      Biomes: [
        { Biome: "Plains", Min: -1, Max: 0 },
        { Biome: "Forest", Min: 0, Max: 1 },
      ],
    });
    expect(result.biomeRanges).toHaveLength(2);
    expect(result.noiseRangeConfig.DefaultBiome).toBe("Plains");
    expect(result.noiseRangeConfig.DefaultTransitionDistance).toBe(48);
  });
});
