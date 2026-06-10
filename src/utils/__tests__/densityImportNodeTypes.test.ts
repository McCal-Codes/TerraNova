import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { jsonToGraph, resolveImportNodeType } from "@/utils/jsonToGraph";
import { analyzeBiome, analyzeGraph } from "@/utils/graphDiagnostics";
import { summarizeDiagnosticsBySeverity } from "@/utils/diagnosticSummary";

const CROWNLANDS_BIOME =
  "C:/Users/wolft/AppData/Roaming/Hytale/UserData/Saves/Worldgen V1/mods/McCal.Crownlands/Server/HytaleGenerator/Biomes/Crownlands Broken Spine.json";

describe("density import node types", () => {
  it("resolves density Constant and BaseHeight without cross-category prefixes", () => {
    expect(resolveImportNodeType("Constant", "Inputs", "density")).toBe("Constant");
    expect(resolveImportNodeType("BaseHeight", "Inputs", "density")).toBe("BaseHeight");
    expect(resolveImportNodeType("Constant", "TintProvider", undefined)).toBe("Tint:Constant");
  });

  it("does not emit false Positions/Tint constraint errors on Crownlands-style density", () => {
    const density = {
      Type: "Multiplier",
      Inputs: [
        { Type: "Constant", Value: 0.26 },
        {
          Type: "CurveMapper",
          Curve: { Type: "Manual", Points: [{ In: 0, Out: 1 }] },
          Inputs: [
            { Type: "BaseHeight", BaseHeightName: "Base", Distance: true },
          ],
        },
      ],
    };

    const { nodes, edges } = jsonToGraph(density, 0, 0, "terrain", "Terrain");
    const constant = nodes.find((n) => (n.data as { fields?: { Value?: number } }).fields?.Value === 0.26);
    const baseHeight = nodes.find((n) => (n.data as { fields?: { BaseHeightName?: string } }).fields?.BaseHeightName === "Base");

    expect(constant?.type).toBe("Constant");
    expect(baseHeight?.type).toBe("BaseHeight");

    const diagnostics = analyzeGraph(nodes, edges, null);
    const constraintErrors = diagnostics.filter((d) => d.code === "field-constraint");
    const disconnected = diagnostics.filter((d) => d.message.includes("disconnected"));
    const crossCategory = diagnostics.filter((d) => d.message.includes("cross-category"));

    expect(constraintErrors).toHaveLength(0);
    expect(disconnected).toHaveLength(0);
    expect(crossCategory).toHaveLength(0);
  });

  it.skipIf(!existsSync(CROWNLANDS_BIOME))(
    "Broken Spine terrain has no false constraint errors after import fix",
    () => {
      const wrapper = JSON.parse(readFileSync(CROWNLANDS_BIOME, "utf8")) as Record<string, unknown>;
      const terrain = wrapper.Terrain as Record<string, unknown>;
      const { nodes, edges } = jsonToGraph(
        terrain.Density as Record<string, unknown>,
        0,
        0,
        "terrain",
        "Terrain",
      );
      const biomeDiags = analyzeBiome(
        {
          Name: wrapper.Name,
          EnvironmentProvider: wrapper.EnvironmentProvider,
          TintProvider: wrapper.TintProvider,
          propMeta: [],
        } as Record<string, unknown>,
        null,
      );
      const all = [...biomeDiags, ...analyzeGraph(nodes, edges, null)];
      const counts = summarizeDiagnosticsBySeverity(all);
      const constraintErrors = all.filter((d) => d.code === "field-constraint");

      expect(constraintErrors).toHaveLength(0);
      expect(counts.error).toBe(0);
      expect(counts.warning).toBeLessThanOrEqual(3);
      expect(counts.info).toBe(1);
    },
  );
});
