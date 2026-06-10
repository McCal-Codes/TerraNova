import { describe, it, expect } from "vitest";
import { evaluateDensityGrid } from "@/utils/density/evaluateGrid";
import type { Node, Edge } from "@xyflow/react";

function makeNode(id: string, type: string, fields: Record<string, unknown> = {}): Node {
  return {
    id,
    type: "generic",
    position: { x: 0, y: 0 },
    data: { type, fields, label: type },
  };
}

describe("terrain-specific density handlers", () => {
  it("TerrainBoolean Union combines inputs with Max semantics", () => {
    const nodes = [
      makeNode("a", "Constant", { Value: 0.2 }),
      makeNode("b", "Constant", { Value: 0.8 }),
      makeNode("tb", "TerrainBoolean", { Operation: "Union" }),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "tb", targetHandle: "Inputs[0]" },
      { id: "e2", source: "b", target: "tb", targetHandle: "Inputs[1]" },
    ];
    const result = evaluateDensityGrid(nodes, edges, 4, -4, 4, 0, "tb");
    expect(result.values[0]).toBeCloseTo(0.8, 2);
  });

  it("DistanceToBiomeEdge returns distance to preview range edge", () => {
    const nodes = [makeNode("d", "DistanceToBiomeEdge")];
    const result = evaluateDensityGrid(nodes, [], 4, -10, 10, 0, "d", {
      contentFields: { previewRangeMin: -10, previewRangeMax: 10 },
    });
    expect(result.values.some((v) => v > 0)).toBe(true);
  });
});
