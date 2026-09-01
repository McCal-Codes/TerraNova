import { describe, it, expect } from "vitest";
import { getLegacyReplacement, LEGACY_TYPE_REPLACEMENTS, isLegacyTypeKey } from "../shared/legacyTypes";

describe("getLegacyReplacement", () => {
  it("returns null for a non-legacy type", () => {
    expect(getLegacyReplacement("Simplex")).toBeNull();
    expect(getLegacyReplacement("Normalizer")).toBeNull();
  });

  it("returns null for legacy types with no direct replacement", () => {
    expect(getLegacyReplacement("SumSelf")).toBeNull();
    expect(getLegacyReplacement("BeardDensity")).toBeNull();
    expect(getLegacyReplacement("Position:Mesh2D")).toBeNull();
    expect(getLegacyReplacement("Scanner:ColumnLinear")).toBeNull();
  });

  it("returns the replacement for density types with 1:1 equivalents", () => {
    expect(getLegacyReplacement("SimplexRidgeNoise2D")).toBe("SimplexNoise2D");
    expect(getLegacyReplacement("SimplexRidgeNoise3D")).toBe("SimplexNoise3D");
    expect(getLegacyReplacement("DoubleNormalizer")).toBe("Normalizer");
    expect(getLegacyReplacement("AverageFunction")).toBe("Mix");
    expect(getLegacyReplacement("FlatCache")).toBe("Cache");
    expect(getLegacyReplacement("Cache2D")).toBe("Cache");
    // Amplitude is not legacy: Update 6 registers AmplitudeDensityAsset and a
    // shipped biome uses it. It takes a FunctionForY curve where
    // AmplitudeConstant takes Scale/Offset, so the old redirect also changed
    // what the node did. See update6Legacy.test.ts.
    expect(getLegacyReplacement("Amplitude")).toBeNull();
    expect(getLegacyReplacement("Zero")).toBe("Constant");
    expect(getLegacyReplacement("One")).toBe("Constant");
    expect(getLegacyReplacement("VoronoiNoise2D")).toBe("CellNoise2D");
    expect(getLegacyReplacement("VoronoiNoise3D")).toBe("CellNoise3D");
  });

  it("returns the replacement for curve types with 1:1 equivalents", () => {
    expect(getLegacyReplacement("Curve:Blend")).toBe("Curve:Sum");
    expect(getLegacyReplacement("Curve:Cache")).toBe("Curve:Manual");
    expect(getLegacyReplacement("Curve:Noise")).toBe("Curve:Manual");
    expect(getLegacyReplacement("Manual")).toBe("Curve:Manual");
    expect(getLegacyReplacement("Curve:Mix")).toBe("Mix");
  });

  it("all replacement targets are NOT themselves legacy types", () => {
    for (const [, replacement] of LEGACY_TYPE_REPLACEMENTS) {
      expect(isLegacyTypeKey(replacement)).toBe(false);
    }
  });
});
