import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { analyzeGraphDefaults, graphHasCaveCarving } from "@/utils/previewAutoFit";

function makeNode(id: string, type: string, fields: Record<string, unknown> = {}): Node {
  return {
    id,
    type: "generic",
    position: { x: 0, y: 0 },
    data: { type, fields, label: type },
  };
}

describe("previewAutoFit cave carving", () => {
  it("detects Min with upstream SimplexNoise3D branch", () => {
    const nodes = [
      makeNode("terr", "Constant"),
      makeNode("noise", "SimplexNoise3D"),
      makeNode("min", "Min"),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "terr", target: "min" },
      { id: "e2", source: "noise", target: "min" },
    ];
    expect(graphHasCaveCarving(nodes, edges)).toBe(true);
  });

  it("widens suggested Y min when cave carving is present", () => {
    const nodes = [
      makeNode("bh", "BaseHeight", { BaseHeightName: "Base" }),
      makeNode("noise", "SimplexNoise3D"),
      makeNode("min", "Min"),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "noise", target: "min" },
    ];
    const withCave = analyzeGraphDefaults(nodes, edges, { Base: 64 });
    const withoutCave = analyzeGraphDefaults(
      [makeNode("bh", "BaseHeight", { BaseHeightName: "Base" })],
      [],
      { Base: 64 },
    );
    expect(withCave.caveCarvingDetected).toBe(true);
    expect(withCave.suggestedYMin).toBeLessThan(withoutCave.suggestedYMin);
  });

  it("suggests underground Y for cave-only graphs without BaseHeight", () => {
    const nodes = [
      makeNode("noise", "SimplexNoise3D"),
      makeNode("inv", "Inverter"),
      makeNode("min", "Min"),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "noise", target: "inv" },
      { id: "e2", source: "inv", target: "min" },
    ];
    const defaults = analyzeGraphDefaults(nodes, edges, { Base: 64 });
    expect(defaults.caveCarvingDetected).toBe(true);
    expect(defaults.confidence).toBe("medium");
    expect(defaults.suggestedYMin).toBe(0);
  });
});
