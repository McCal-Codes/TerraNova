import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import {
  analyzeGraphPreviewFeatures,
  graphHasImportedCaveModule,
  graphHasImportedRiverModule,
  graphHasSnakeCaveNoise,
  inferCaveVerticalExtentFromCurves,
  computePreviewBelowPad,
} from "@/utils/graphPreviewFeatures";
import { evaluateDensityGrid, createEvaluationContext } from "@/utils/densityEvaluator";
import { jsonToGraph } from "@/utils/jsonToGraph";
import {
  collectExternalImportedNames,
  resolveDensityExportsFromCache,
} from "@/utils/densityExportRegistry";

function makeNode(id: string, type: string, fields: Record<string, unknown> = {}): Node {
  return {
    id,
    type: "generic",
    position: { x: 0, y: 0 },
    data: { type, fields, label: type },
  };
}

describe("graphPreviewFeatures — release cave/river patterns", () => {
  it("detects Plains-style imported cave modules", () => {
    const nodes = [makeNode("imp", "Imported", { Name: "Plains1_Caves_Terrain" })];
    expect(graphHasImportedCaveModule(nodes)).toBe(true);
    const features = analyzeGraphPreviewFeatures(nodes, [], {});
    expect(features.importedCaveModule).toBe(true);
    expect(features.undergroundCarving).toBe(true);
    expect(features.tags).toContain("imported caves");
  });

  it("detects World-River-Map imports as river + hydrography", () => {
    const nodes = [makeNode("imp", "Imported", { Name: "World-River-Map" })];
    expect(graphHasImportedRiverModule(nodes)).toBe(true);
    const features = analyzeGraphPreviewFeatures(nodes, [], {});
    expect(features.importedRiverModule).toBe(true);
    expect(features.hydrography).toBe(true);
    expect(features.tags).toContain("imported rivers");
  });

  it("detects Caves-Snakes noise seeds", () => {
    const nodes = [makeNode("n", "SimplexNoise2D", { Seed: "Caves-Snakes" })];
    expect(graphHasSnakeCaveNoise(nodes)).toBe(true);
  });

  it("extends below pad from BaseHeight distance curve extent", () => {
    const nodes = [
      makeNode("bh", "BaseHeight", { BaseHeightName: "Base", Distance: true }),
      makeNode("cm", "CurveMapper", {
        Curve: {
          Type: "Manual",
          Points: [
            { In: -90, Out: 1 },
            { In: 60, Out: -1 },
          ],
        },
      }),
    ];
    const edges: Edge[] = [{ id: "e1", source: "bh", target: "cm", targetHandle: "Input" }];
    const extent = inferCaveVerticalExtentFromCurves(nodes, edges);
    expect(extent?.minIn).toBe(-90);
    const pad = computePreviewBelowPad({ undergroundCarving: true, overhangEmphasis: false, hydrography: false, importedCaveModule: false }, extent);
    expect(pad).toBeGreaterThanOrEqual(106);
  });
});

describe("densityExportRegistry — external Imported eval", () => {
  it("collects unbound Imported names with missing edges array", () => {
    const nodes = [makeNode("imp", "Imported", { Name: "Test" })];
    expect(collectExternalImportedNames(nodes, undefined)).toEqual(["Test"]);
  });

  it("collects unbound Imported names", () => {
    const nodes = [
      makeNode("imp", "Imported", { Name: "Plains1_Caves_Terrain" }),
      makeNode("wired", "Imported", { Name: "Inline" }),
      makeNode("src", "Constant", { Value: 1 }),
    ];
    const edges: Edge[] = [{ id: "e1", source: "src", target: "wired", targetHandle: "Input" }];
    expect(collectExternalImportedNames(nodes, edges)).toEqual(["Plains1_Caves_Terrain"]);
  });

  it("evaluates Min terrain with registered external cave export", () => {
    const exportDensity = {
      Type: "Constant",
      Value: -0.75,
    };
    const { nodes: exportNodes, edges: exportEdges } = jsonToGraph(exportDensity, 0, 0, "cave_export");

    const terrainDensity = {
      Type: "Min",
      Inputs: [
        { Type: "Constant", Value: 1 },
        { Type: "Imported", Name: "Test_Caves_Module" },
      ],
    };
    const { nodes, edges } = jsonToGraph(terrainDensity, 0, 0, "biome");

    const externalDensityExports = {
      Test_Caves_Module: { nodes: exportNodes, edges: exportEdges },
    };

    const ctx = createEvaluationContext(nodes, edges, undefined, {
      contentFields: { Base: 64 },
      externalDensityExports,
    });
    expect(ctx).not.toBeNull();
    const val = ctx!.evaluate(ctx!.rootId, 0, 64, 0);
    expect(val).toBe(-0.75);

    const grid = evaluateDensityGrid(nodes, edges, 4, -4, 4, 64, undefined, {
      contentFields: { Base: 64 },
      externalDensityExports,
    });
    expect(grid.maxValue).toBe(-0.75);
    expect(grid.minValue).toBe(-0.75);
  });

  it("indexes bundled reference exports when present", () => {
    const cached = resolveDensityExportsFromCache(["Cave_Snakes_Ceiling"]);
    if (cached.Cave_Snakes_Ceiling) {
      expect(cached.Cave_Snakes_Ceiling.nodes.length).toBeGreaterThan(0);
    }
  });
});
