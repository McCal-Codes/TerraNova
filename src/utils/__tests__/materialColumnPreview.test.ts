import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import {
  buildSyntheticColumnDensities,
  evaluateMaterialColumnPreview,
  type MaterialScaffoldPreset,
} from "@/utils/materialColumnPreview";

function makeNode(id: string, type: string, fields: Record<string, unknown> = {}): Node {
  return { id, position: { x: 0, y: 0 }, type, data: { type, fields } };
}

function makeEdge(source: string, target: string, targetHandle: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    targetHandle,
    sourceHandle: "output",
  };
}

describe("buildSyntheticColumnDensities", () => {
  it("surface preset is solid below surfaceY", () => {
    const densities = buildSyntheticColumnDensities("surface", {
      resolution: 1,
      ySlices: 4,
      yMin: 0,
      yMax: 100,
      surfaceY: 50,
    });
    expect(densities[0]).toBeGreaterThan(0);
    expect(densities[3]).toBeLessThan(0);
  });

  it("deepColumn is solid throughout", () => {
    const densities = buildSyntheticColumnDensities("deepColumn", {
      resolution: 1,
      ySlices: 8,
      yMin: 0,
      yMax: 128,
      surfaceY: 64,
    });
    for (let i = 0; i < 8; i++) {
      expect(densities[i]).toBeGreaterThan(0);
    }
  });
});

describe("evaluateMaterialColumnPreview", () => {
  it("returns layered materials for SpaceAndDepth stack", () => {
    const nodes = [
      makeNode("sad", "Material:SpaceAndDepth", {
        LayerContext: "DEPTH_INTO_FLOOR",
        MaxExpectedDepth: 8,
      }),
      makeNode("layer0", "Layer:ConstantThickness", { Thickness: 1 }),
      makeNode("grass", "Material:Constant", { Material: "Soil_Grass" }),
      makeNode("layer1", "Layer:ConstantThickness", { Thickness: 2 }),
      makeNode("dirt", "Material:Constant", { Material: "Soil_Dirt" }),
    ];
    const edges: Edge[] = [
      makeEdge("layer0", "sad", "Layers[0]"),
      makeEdge("grass", "layer0", "Material"),
      makeEdge("layer1", "sad", "Layers[1]"),
      makeEdge("dirt", "layer1", "Material"),
    ];

    const result = evaluateMaterialColumnPreview({
      materialGraph: { nodes, edges, source: "canvas" },
      preset: "surface",
      surfaceY: 64,
      yMin: 0,
      yMax: 128,
      ySlices: 32,
    });

    expect(result).not.toBeNull();
    const solids = result!.rows.filter((r) => r.isSolid && r.material);
    expect(solids.length).toBeGreaterThan(0);
    const names = new Set(solids.map((r) => r.material));
    expect(names.size).toBeGreaterThanOrEqual(1);
  });

  it("returns null when graph is empty", () => {
    expect(
      evaluateMaterialColumnPreview({
        materialGraph: { nodes: [], edges: [], source: "none" },
        preset: "surface" as MaterialScaffoldPreset,
      }),
    ).toBeNull();
  });
});
