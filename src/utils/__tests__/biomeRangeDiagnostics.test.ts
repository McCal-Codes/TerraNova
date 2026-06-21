import { describe, it, expect } from "vitest";
import { analyzeNoiseRange, biomeRangeExportWarnings } from "../biomeRangeDiagnostics";

describe("biomeRangeDiagnostics", () => {
  it("reports empty ranges as error", () => {
    const diags = analyzeNoiseRange({
      biomeRanges: [],
      noiseRangeConfig: null,
    });
    expect(diags.some((d) => d.code === "biome-range-empty")).toBe(true);
  });

  it("does not report gap or default warnings when ranges are empty", () => {
    const diags = analyzeNoiseRange({
      biomeRanges: [],
      noiseRangeConfig: {
        DefaultBiome: "MyBiome",
        DefaultTransitionDistance: 32,
        MaxBiomeEdgeDistance: 48,
      },
    });
    expect(diags).toHaveLength(1);
    expect(diags[0].code).toBe("biome-range-empty");
  });

  it("reports gap warnings for partial coverage", () => {
    const diags = analyzeNoiseRange({
      biomeRanges: [{ Biome: "Mid", Min: -0.25, Max: 0.25 }],
      noiseRangeConfig: {
        DefaultBiome: "Mid",
        DefaultTransitionDistance: 32,
        MaxBiomeEdgeDistance: 48,
      },
    });
    expect(diags.some((d) => d.code === "biome-range-gap")).toBe(true);
  });

  it("export warnings include errors and warnings only", () => {
    const warnings = biomeRangeExportWarnings([], null);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes("no biome ranges"))).toBe(true);
  });
});
