import { describe, it, expect } from "vitest";
import { ALL_DEFAULTS, DENSITY_DEFAULTS, CURVE_DEFAULTS, getDefaults, getLegacyDefaultsForType } from "../defaults";
import { resolveNodeTypeKey } from "@/utils/nodeTypeKeys";
import { AssetCategory } from "../types";

describe("V2 CODEC default alignment", () => {
  it("SimplexNoise2D defaults match V2", () => {
    const d = DENSITY_DEFAULTS.SimplexNoise2D;
    expect(d.Lacunarity).toBe(1.0);
    expect(d.Persistence).toBe(1.0);
    expect(d.Scale).toBe(1.0);
    expect(d.Octaves).toBe(1);
  });

  it("SimplexNoise3D defaults match V2", () => {
    const d = DENSITY_DEFAULTS.SimplexNoise3D;
    expect(d.Lacunarity).toBe(1.0);
    expect(d.Persistence).toBe(1.0);
    expect(d.Scale).toBe(1.0);
    expect(d.Octaves).toBe(1);
  });

  it("Clamp defaults use V2 WallA/WallB naming", () => {
    const d = DENSITY_DEFAULTS.Clamp;
    // V2: WallA = upper bound, WallB = lower bound
    expect(d.WallA).toBeDefined();
    expect(d.WallB).toBeDefined();
    // Verify they survive JSON round-trip (unlike Infinity which becomes null)
    expect(JSON.parse(JSON.stringify(d.WallA))).toBeDefined();
    expect(JSON.parse(JSON.stringify(d.WallB))).toBeDefined();
  });

  it("Curve Constant defaults to 0.0", () => {
    expect(CURVE_DEFAULTS.Constant.Value).toBe(0.0);
  });

  it("FractalNoise2D defaults match V2", () => {
    const d = DENSITY_DEFAULTS.FractalNoise2D;
    expect(d.Scale).toBe(1.0);
    expect(d.Lacunarity).toBe(1.0);
    expect(d.Persistence).toBe(1.0);
    expect(d.Octaves).toBe(1);
  });

  it("FractalNoise3D defaults match V2", () => {
    const d = DENSITY_DEFAULTS.FractalNoise3D;
    expect(d.Scale).toBe(1.0);
    expect(d.Lacunarity).toBe(1.0);
    expect(d.Persistence).toBe(1.0);
    expect(d.Octaves).toBe(1);
  });

  it("SmoothMin/SmoothMax have no scalar fields in V2", () => {
    // V2 SmoothMin/SmoothMax have no user-editable fields
    expect(Object.keys(DENSITY_DEFAULTS.SmoothMin).length).toBe(0);
    expect(Object.keys(DENSITY_DEFAULTS.SmoothMax).length).toBe(0);
  });
});

describe("getDefaults() — schema-driven API", () => {
  it("returns defaults for a density type by bare name", () => {
    const d = getDefaults("SimplexNoise2D");
    expect(d.Scale).toBe(1.0);
    expect(d.Octaves).toBe(1);
  });

  it("density Exported defaults use ExportAs, not legacy Name", () => {
    const d = getDefaults("Exported");
    expect(d.ExportAs).toBe("");
    expect(d.SingleInstance).toBe(false);
    expect(d.Name).toBeUndefined();
  });

  it("returns defaults for a prefixed bundle type", () => {
    const d = getDefaults("Curve:Manual");
    expect(d).toBeDefined();
  });

  it("falls back to legacy for types not in the bundle", () => {
    const d = getDefaults("FractalNoise2D");
    expect(d.Scale).toBe(1.0);
    expect(d.Octaves).toBe(1);
  });

  it("returns {} for completely unknown types", () => {
    const d = getDefaults("NonExistentType_XYZ");
    expect(d).toEqual({});
  });

  it("returns defaults for a material type by prefixed key", () => {
    const d = getDefaults("MaterialProvider:SpaceAndDepth");
    expect(d).toBeDefined();
    // Legacy fallback should have LayerContext
    expect(d.LayerContext ?? d.MaxExpectedDepth).toBeDefined();
  });

  it("keeps schema-only category entries canonical in ALL_DEFAULTS", () => {
    // `type` holds the bare name and `category` carries the prefix, matching
    // the hand-written entries. resolveNodeTypeKey turns the pair back into the
    // editor key, so a bare name here is not a loss of information.
    const propDistributionAssigned = ALL_DEFAULTS.filter(
      (entry) => entry.type === "Assigned" && entry.category === AssetCategory.PropDistribution,
    );
    expect(propDistributionAssigned).toHaveLength(1);
    expect(resolveNodeTypeKey(propDistributionAssigned[0])).toBe("PropDistribution:Assigned");

    const alwaysTrueCondition = ALL_DEFAULTS.filter((entry) => entry.type === "AlwaysTrueCondition");
    expect(alwaysTrueCondition).toHaveLength(1);
    expect(alwaysTrueCondition[0].category).toBe(AssetCategory.Condition);
  });

  it("lets a hand-written default outrank a generated one", () => {
    // Generated defaults are Java field initialisers, which are often the inert
    // value. Jitter2d initialises Magnitude to 0 — a jitter that does nothing —
    // while the legacy map holds 14. Curated bundle > legacy > generated.
    expect(getDefaults("Position:Jitter2d").Magnitude).toBe(14);
    expect(getDefaults("Prop:RandomRotator").Seed).toBe("A");
    expect(getDefaults("Prop:RandomRotator").HorizontalRotations).toBe(true);
  });

  it("still takes fields the hand-written defaults never had", () => {
    // Ranking generated defaults lower must not mean ignoring them: these are
    // real codec fields that had no entry before.
    expect(getDefaults("Prop:Weighted")).toMatchObject({ Weight: 1 });
    expect(getDefaults("Curve:Ceiling")).toMatchObject({ Ceiling: 0 });
    // An array field has no Java initialiser to read, so it is seeded empty
    // rather than left absent.
    expect(getDefaults("Prop:Weighted").Entries).toEqual([]);
  });

  it("gives every entry an editor key that carries its category", () => {
    // A schema-derived entry that kept its bundle prefix would produce
    // "VectorProvider:Adder" here instead of the editor's "Vector:Adder", and
    // would show that raw key in the palette.
    const adder = ALL_DEFAULTS.find(
      (e) => e.type === "Adder" && e.category === AssetCategory.VectorProvider,
    );
    expect(adder).toBeDefined();
    expect(resolveNodeTypeKey(adder!)).toBe("Vector:Adder");

    const doublePrefixed = ALL_DEFAULTS.filter((e) => e.type.includes(":"));
    // Only the handful of entries whose bundle key genuinely has no category
    // prefix to strip should still contain a colon.
    for (const e of doublePrefixed) {
      expect(resolveNodeTypeKey(e)).toBe(e.type);
    }
  });
});

describe("getLegacyDefaultsForType", () => {
  it("resolves Material:Constant to material provider defaults", () => {
    expect(getLegacyDefaultsForType("Material:Constant")).toEqual({
      Material: "Rock_Lime_Cobble",
    });
  });

  it("getDefaults uses the same legacy map for Material:Constant", () => {
    expect(getDefaults("Material:Constant").Material).toBe("Rock_Lime_Cobble");
  });
});
