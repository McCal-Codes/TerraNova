import { describe, it, expect } from "vitest";
import { migrateLegacyPropsAndAtmosphere } from "../migrateLegacyPropsAndAtmosphere";
import { normalizeImport } from "../fileTypeDetection";

describe("migrateLegacyPropsAndAtmosphere", () => {
  it("converts Prop:Conditional to Prop:Weighted", () => {
    const biome = {
      Props: [
        {
          Assignments: {
            Type: "Constant",
            Prop: {
              Type: "Conditional",
              Threshold: 0.5,
              Condition: { Type: "SimplexNoise2D", Seed: "oak" },
              TrueInput: { Type: "Prefab", Path: "trees/oak" },
              FalseInput: { Type: "Prefab", Path: "trees/birch" },
            },
          },
        },
      ],
    };

    const { result, conversions } = migrateLegacyPropsAndAtmosphere(biome);
    const prop = (result.Props as Array<{ Assignments: { Prop: Record<string, unknown> } }>)[0]
      .Assignments.Prop;

    expect(prop.Type).toBe("Weighted");
    expect(prop.Seed).toBe("oak");
    expect(Array.isArray(prop.Entries)).toBe(true);
    expect(conversions).toContain("Prop:Conditional → Prop:Weighted");
  });

  it("converts Prop:Surface to Prop:Locator", () => {
    const biome = {
      Props: [
        {
          Assignments: {
            Type: "Constant",
            Prop: {
              Type: "Surface",
              Pattern: { Type: "Surface" },
              Scanner: { Type: "ColumnLinear" },
            },
          },
        },
      ],
    };

    const { result, conversions } = migrateLegacyPropsAndAtmosphere(biome);
    const prop = (result.Props as Array<{ Assignments: { Prop: Record<string, unknown> } }>)[0]
      .Assignments.Prop;

    expect(prop.Type).toBe("Locator");
    expect((prop.Prop as Record<string, unknown>).Type).toBe("Manual");
    expect(conversions).toContain("Prop:Surface → Prop:Locator");
  });

  it("unwraps Environment:Exported to its Input", () => {
    const biome = {
      EnvironmentProvider: {
        Type: "Exported",
        Input: { Type: "Constant", Environment: "Env_Zone1_Forests" },
      },
    };

    const { result, conversions } = migrateLegacyPropsAndAtmosphere(biome);
    expect((result.EnvironmentProvider as Record<string, unknown>).Type).toBe("Constant");
    expect(conversions.some((c) => c.includes("Environment:Exported"))).toBe(true);
  });

  it("migrates Directionality:Uniform to Random", () => {
    const biome = {
      Props: [
        {
          Assignments: {
            Type: "Constant",
            Prop: {
              Type: "Prefab",
              Path: "props/tree",
              Directionality: { Type: "Uniform" },
            },
          },
        },
      ],
    };

    const { result, conversions } = migrateLegacyPropsAndAtmosphere(biome);
    const dir = (
      (result.Props as Array<{ Assignments: { Prop: Record<string, unknown> } }>)[0]
        .Assignments.Prop.Directionality as Record<string, unknown>
    );
    expect(dir.Type).toBe("Random");
    expect(conversions).toContain("Directionality:Uniform → Directionality:Random");
  });
});

describe("normalizeImport legacy provider migration", () => {
  it("runs prop migration on biome wrappers", () => {
    const normalized = normalizeImport({
      Name: "test",
      Terrain: { Type: "DAOTerrain", Density: { Type: "Constant", Value: 0 } },
      Props: [
        {
          Assignments: {
            Type: "Constant",
            Prop: {
              Type: "Conditional",
              TrueInput: { Type: "Prefab", Path: "a" },
              FalseInput: { Type: "Prefab", Path: "b" },
            },
          },
        },
      ],
    });

    const prop = (normalized.Props as Array<{ Assignments: { Prop: Record<string, unknown> } }>)[0]
      .Assignments.Prop;
    expect(prop.Type).toBe("Weighted");
  });
});
