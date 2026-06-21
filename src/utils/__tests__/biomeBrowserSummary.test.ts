import { describe, expect, it } from "vitest";
import { extractBiomeBrowserMeta } from "../biomeBrowserSummary";

describe("extractBiomeBrowserMeta", () => {
  it("reads Constant environment and tint delimiter colors", () => {
    const meta = extractBiomeBrowserMeta({
      Name: "Plains",
      EnvironmentProvider: { Type: "Constant", Environment: "Env_Zone1_Plains" },
      TintProvider: {
        Type: "DensityDelimited",
        Delimiters: [
          { Tint: { Type: "Constant", Color: "#5b9e28" } },
          { Tint: { Type: "Constant", Color: "#6ca229" } },
        ],
      },
    });
    expect(meta.environmentLabel).toBe("Env_Zone1_Plains");
    expect(meta.tintColors).toEqual(["#5b9e28", "#6ca229"]);
  });

  it("labels server default for empty environment provider", () => {
    const meta = extractBiomeBrowserMeta({
      EnvironmentProvider: {},
      TintProvider: { Type: "Constant", Color: "#aabbcc" },
    });
    expect(meta.environmentLabel).toBe("uses server default");
    expect(meta.tintColors).toEqual(["#aabbcc"]);
  });
});
