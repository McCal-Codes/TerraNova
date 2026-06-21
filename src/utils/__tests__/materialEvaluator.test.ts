import { describe, expect, it } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { createEvaluationContext } from "@/utils/densityEvaluator";
import { evaluateMaterialGraph } from "../materialEvaluator";

function makeNode(id: string, type: string, fields: Record<string, unknown> = {}): Node {
  return { id, position: { x: 0, y: 0 }, type, data: { type, fields } };
}

function makeEdge(source: string, target: string, targetHandle: string): Edge {
  return {
    id: `${source}-${target}-${targetHandle}`,
    source,
    target,
    targetHandle,
    sourceHandle: "output",
  };
}

describe("evaluateMaterialGraph — SpaceAndDepth Condition", () => {
  it("skips layers when wired SmallerThanCondition fails", () => {
    const n = 4;
    const ys = 4;
    const densities = new Float32Array(n * n * ys);
    // Solid column with shallow space above surface
    for (let y = 0; y < ys; y++) {
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++) {
          densities[y * n * n + z * n + x] = y < 2 ? 1 : 0;
        }
      }
    }

    const nodes = [
      makeNode("sad", "Material:SpaceAndDepth", {
        LayerContext: "DEPTH_INTO_FLOOR",
        MaxExpectedDepth: 8,
      }),
      makeNode("cond", "Condition:SmallerThanCondition", {
        ContextToCheck: "SPACE_ABOVE_FLOOR",
        Threshold: -1,
      }),
      makeNode("layer0", "Layer:ConstantThickness", { Thickness: 1 }),
      makeNode("mat", "Material:Constant", { Material: "Dirt" }),
    ];
    const edges: Edge[] = [
      makeEdge("cond", "sad", "Condition"),
      makeEdge("layer0", "sad", "Layers[0]"),
      makeEdge("mat", "layer0", "Material"),
    ];

    const result = evaluateMaterialGraph(nodes, edges, densities, n, ys, 0, n, 0, ys);
    expect(result).not.toBeNull();
    expect(result!.palette.some((m) => m.name === "Dirt")).toBe(false);
  });

  it("applies layers when wired AlwaysTrueCondition is connected", () => {
    const n = 4;
    const ys = 4;
    const densities = new Float32Array(n * n * ys);
    for (let y = 0; y < ys; y++) {
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++) {
          densities[y * n * n + z * n + x] = y < 2 ? 1 : 0;
        }
      }
    }

    const nodes = [
      makeNode("sad", "Material:SpaceAndDepth", {
        LayerContext: "DEPTH_INTO_FLOOR",
        MaxExpectedDepth: 8,
      }),
      makeNode("cond", "Condition:AlwaysTrueCondition", {}),
      makeNode("layer0", "Layer:ConstantThickness", { Thickness: 2 }),
      makeNode("mat", "Material:Constant", { Material: "Dirt" }),
    ];
    const edges: Edge[] = [
      makeEdge("cond", "sad", "Condition"),
      makeEdge("layer0", "sad", "Layers[0]"),
      makeEdge("mat", "layer0", "Material"),
    ];

    const result = evaluateMaterialGraph(nodes, edges, densities, n, ys, 0, n, 0, ys);
    expect(result).not.toBeNull();
    const dirtIdx = result!.palette.findIndex((m) => m.name === "Dirt");
    expect(dirtIdx).toBeGreaterThanOrEqual(0);
    expect(result!.materialIds.some((id) => id === dirtIdx)).toBe(true);
  });
});

describe("evaluateMaterialGraph — FieldFunction Delimiters", () => {
  it("picks material band from DelimiterRanges using density field value", () => {
    const n = 4;
    const ys = 4;
    const densities = new Float32Array(n * n * ys);
    for (let y = 0; y < ys; y++) {
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++) {
          densities[y * n * n + z * n + x] = y < 2 ? 1 : 0;
        }
      }
    }

    const nodes = [
      makeNode("dconst", "Constant", { Value: 0.75 }),
      makeNode("ff", "Material:FieldFunction", {
        DelimiterRanges: [
          { From: 0, To: 0.5 },
          { From: 0.5, To: 1 },
        ],
      }),
      makeNode("m0", "Material:Constant", { Material: "Stone" }),
      makeNode("m1", "Material:Constant", { Material: "Sand" }),
    ];
    const edges: Edge[] = [
      makeEdge("dconst", "ff", "FieldFunction"),
      makeEdge("m0", "ff", "Materials[0]"),
      makeEdge("m1", "ff", "Materials[1]"),
    ];

    const densityCtx = createEvaluationContext(nodes, edges, "ff")!;

    const result = evaluateMaterialGraph(
      nodes,
      edges,
      densities,
      n,
      ys,
      0,
      n,
      0,
      ys,
      densityCtx,
    );
    expect(result).not.toBeNull();
    const sandIdx = result!.palette.findIndex((m) => m.name === "Sand");
    expect(sandIdx).toBeGreaterThanOrEqual(0);
    expect(result!.materialIds.some((id) => id === sandIdx)).toBe(true);
  });
});
