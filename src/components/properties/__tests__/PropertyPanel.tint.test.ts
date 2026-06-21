import { describe, it, expect } from "vitest";
import {
  applyBiomeTintBand,
  isSimplexNoise2DTint,
  readTintDensity,
  updateTintDensity,
  updateTintDelimiters,
} from "../biomeTintUtils";

function getDelimiterColor(delimiters: Array<Record<string, unknown>>, index: number): string | undefined {
  const tint = delimiters[index]?.Tint as Record<string, unknown> | undefined;
  return typeof tint?.Color === "string" ? tint.Color : undefined;
}

describe("applyBiomeTintBand", () => {
  it("initializes all 3 tint bands when provider is missing", () => {
    const next = applyBiomeTintBand(undefined, 0, "#112233");
    const delimiters = next.Delimiters as Array<Record<string, unknown>>;

    expect(next.Type).toBe("DensityDelimited");
    expect(delimiters.length).toBeGreaterThanOrEqual(3);
    expect(getDelimiterColor(delimiters, 0)).toBe("#112233");
    expect(getDelimiterColor(delimiters, 1)).toBe("#6ca229");
    expect(getDelimiterColor(delimiters, 2)).toBe("#7ea629");
  });

  it("preserves existing provider fields while updating selected band", () => {
    const existing = {
      Type: "DensityDelimited",
      ExportAs: "BiomeTint",
      Delimiters: [
        { Threshold: 0.1, Tint: { Color: "#224422", Saturation: 0.5 } },
      ],
    } satisfies Record<string, unknown>;

    const next = applyBiomeTintBand(existing, 1, "#778899");
    const delimiters = next.Delimiters as Array<Record<string, unknown>>;

    expect(next.ExportAs).toBe("BiomeTint");
    expect(getDelimiterColor(delimiters, 0)).toBe("#224422");
    expect(getDelimiterColor(delimiters, 1)).toBe("#778899");
    expect(getDelimiterColor(delimiters, 2)).toBe("#7ea629");
    expect((delimiters[0].Tint as Record<string, unknown>).Saturation).toBe(0.5);
  });

  it("supports writing bands beyond index 2 while keeping base 3-band gradient", () => {
    const next = applyBiomeTintBand({ Delimiters: [] }, 4, "#abcdef");
    const delimiters = next.Delimiters as Array<Record<string, unknown>>;

    expect(delimiters.length).toBeGreaterThanOrEqual(5);
    expect(getDelimiterColor(delimiters, 0)).toBe("#5b9e28");
    expect(getDelimiterColor(delimiters, 1)).toBe("#6ca229");
    expect(getDelimiterColor(delimiters, 2)).toBe("#7ea629");
    expect(getDelimiterColor(delimiters, 4)).toBe("#abcdef");
  });

  it("writes Range on each new delimiter matching real Hytale -1 to 1 format", () => {
    const next = applyBiomeTintBand(undefined, 0, "#112233");
    const delimiters = next.Delimiters as Array<Record<string, unknown>>;

    expect((delimiters[0].Range as Record<string, unknown>).MinInclusive).toBe(-1);
    expect((delimiters[0].Range as Record<string, unknown>).MaxExclusive).toBe(-0.33);
    expect((delimiters[1].Range as Record<string, unknown>).MinInclusive).toBe(-0.33);
    expect((delimiters[1].Range as Record<string, unknown>).MaxExclusive).toBe(0.33);
    expect((delimiters[2].Range as Record<string, unknown>).MinInclusive).toBe(0.33);
    expect((delimiters[2].Range as Record<string, unknown>).MaxExclusive).toBe(1);
  });

  it("writes Tint.Type: Constant on each delimiter matching real Hytale format", () => {
    const next = applyBiomeTintBand(undefined, 0, "#112233");
    const delimiters = next.Delimiters as Array<Record<string, unknown>>;

    for (let i = 0; i < 3; i++) {
      expect((delimiters[i].Tint as Record<string, unknown>).Type).toBe("Constant");
    }
  });

  it("preserves existing Range when present, adds default Range when missing", () => {
    const existing = {
      Type: "DensityDelimited",
      Delimiters: [
        { Range: { MinInclusive: -1, MaxExclusive: -0.33 }, Tint: { Type: "Constant", Color: "#446A1F" } },
        { Range: { MinInclusive: -0.33, MaxExclusive: 0.33 }, Tint: { Type: "Constant", Color: "#4B7020" } },
      ],
    } satisfies Record<string, unknown>;

    const next = applyBiomeTintBand(existing, 2, "#3E661D");
    const delimiters = next.Delimiters as Array<Record<string, unknown>>;

    expect((delimiters[0].Range as Record<string, unknown>).MinInclusive).toBe(-1);
    expect((delimiters[1].Range as Record<string, unknown>).MinInclusive).toBe(-0.33);
    expect((delimiters[2].Range as Record<string, unknown>).MinInclusive).toBe(0.33);
    expect((delimiters[2].Range as Record<string, unknown>).MaxExclusive).toBe(1);
  });

  it("preserves Constant tint providers instead of creating delimiter fields", () => {
    const next = applyBiomeTintBand({
      Type: "Constant",
      ExportAs: "FlatTint",
      Color: "#224422",
    }, 0, "#445566");

    expect(next.Type).toBe("Constant");
    expect(next.Color).toBe("#445566");
    expect(next.ExportAs).toBe("FlatTint");
    expect("Delimiters" in next).toBe(false);
    expect("Density" in next).toBe(false);
  });
});

describe("tint density helpers", () => {
  it("detects SimplexNoise2D tint density", () => {
    expect(isSimplexNoise2DTint({ Density: { Type: "SimplexNoise2D" } })).toBe(true);
    expect(isSimplexNoise2DTint({ Density: { Type: "TerrainDensity" } })).toBe(false);
  });

  it("updates density fields while preserving delimiters", () => {
    const provider = {
      Type: "DensityDelimited",
      Delimiters: [{ Tint: { Color: "#fff" } }],
      Density: { Type: "SimplexNoise2D", Scale: 50 },
    };
    const next = updateTintDensity(provider, { Scale: 120, Seed: "custom" });
    expect((next.Density as Record<string, unknown>).Scale).toBe(120);
    expect((next.Density as Record<string, unknown>).Seed).toBe("custom");
    expect(Array.isArray(next.Delimiters)).toBe(true);
  });

  it("readTintDensity returns defaults when missing", () => {
    const density = readTintDensity(undefined);
    expect(density.Type).toBe("SimplexNoise2D");
    expect(density.Scale).toBe(100);
  });

  it("updateTintDelimiters replaces delimiter array", () => {
    const next = updateTintDelimiters(undefined, [
      { Range: { MinInclusive: -1, MaxExclusive: 0 }, Tint: { Type: "Constant", Color: "#abc" } },
    ]);
    expect((next.Delimiters as unknown[]).length).toBe(1);
    expect(next.Type).toBe("DensityDelimited");
  });
});
