import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import {
  analyzeGraphPreviewFeatures,
  graphHasUndergroundCarving,
  suggestPreviewYLevel,
  graphHasImportedCaveModule,
} from "@/utils/graphPreviewFeatures";

function makeNode(id: string, type: string, fields: Record<string, unknown> = {}): Node {
  return {
    id,
    type: "generic",
    position: { x: 0, y: 0 },
    data: { type, fields, label: type },
  };
}

describe("graphPreviewFeatures", () => {
  it("detects CaveDensity without Min combiner", () => {
    const nodes = [makeNode("cave", "CaveDensity"), makeNode("out", "Constant")];
    expect(graphHasUndergroundCarving(nodes, [])).toBe(true);
  });

  it("detects TerrainBoolean subtraction", () => {
    const nodes = [
      makeNode("a", "Constant"),
      makeNode("b", "Ellipsoid"),
      makeNode("bool", "TerrainBoolean", { Operation: "Subtraction" }),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "bool" },
      { id: "e2", source: "b", target: "bool" },
    ];
    expect(graphHasUndergroundCarving(nodes, edges)).toBe(true);
  });

  it("detects Min with upstream Ellipsoid carve", () => {
    const nodes = [
      makeNode("terr", "Constant"),
      makeNode("void", "Ellipsoid"),
      makeNode("min", "Min"),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "terr", target: "min" },
      { id: "e2", source: "void", target: "min" },
    ];
    expect(graphHasUndergroundCarving(nodes, edges)).toBe(true);
  });

  it("enables hydrography from material config + Water content field", () => {
    const features = analyzeGraphPreviewFeatures(
      [],
      [],
      { Base: 100, Water: 62 },
      { layers: [], fluidMaterial: "Water_Source", fluidLevel: 0 },
    );
    expect(features.hydrography).toBe(true);
    expect(features.waterSurfaceY).toBe(62);
    expect(features.tags).toContain("hydrography");
  });

  it("suggestPreviewYLevel uses water surface for hydro-only biomes", () => {
    const features = analyzeGraphPreviewFeatures(
      [],
      [],
      { Water: 62 },
      { layers: [], fluidMaterial: "Water_Source", fluidLevel: 0 },
    );
    expect(suggestPreviewYLevel(features, 100, 95)).toBe(62);
  });

  it("detects imported cave module as underground carving", () => {
    const nodes = [makeNode("imp", "Imported", { Name: "Plains1_Caves_Mountains" })];
    expect(graphHasImportedCaveModule(nodes)).toBe(true);
    expect(graphHasUndergroundCarving(nodes, [])).toBe(true);
  });

  it("suggestPreviewYLevel keeps terrain median when underground carving", () => {
    const features = analyzeGraphPreviewFeatures(
      [makeNode("cave", "CaveDensity")],
      [],
      { Water: 62 },
      { layers: [], fluidMaterial: "Water_Source", fluidLevel: 0 },
    );
    expect(suggestPreviewYLevel(features, 100, 48)).toBe(48);
  });
});
