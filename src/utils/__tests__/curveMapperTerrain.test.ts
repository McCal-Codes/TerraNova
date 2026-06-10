import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { jsonToGraph } from "../jsonToGraph";
import { createEvaluationContext } from "../densityEvaluator";
import { analyzeGraph } from "../graphDiagnostics";

function makeMyBiomeTerrain(curvePoints: { In: number; Out: number }[]) {
  return {
    Type: "Sum",
    Inputs: [
      {
        Type: "SimplexNoise2D",
        Lacunarity: 2,
        Octaves: 3,
        Persistence: 0.5,
        Scale: 100,
        Seed: "A",
      },
      {
        Type: "CurveMapper",
        Curve: { Type: "Manual", Points: curvePoints },
        Input: {
          Type: "BaseHeight",
          BaseHeightName: "Base",
          Distance: true,
        },
      },
    ],
  };
}

function surfaceYSpreadAtSum(nodes: Node[], edges: Edge[]): number {
  const sumNode = nodes.find((n) => (n.data as { type: string }).type === "Sum")!;
  const ctx = createEvaluationContext(nodes, edges, sumNode.id, {
    contentFields: { Base: 100, BaseHeight: 100 },
  })!;

  const crossingYs: number[] = [];
  for (let xi = 0; xi < 8; xi++) {
    const wx = -96 + xi * 24;
    for (let y = 40; y <= 160; y++) {
      const d0 = ctx.evaluate(sumNode.id, wx, y, 0);
      const d1 = ctx.evaluate(sumNode.id, wx, y + 1, 0);
      if ((d0 >= 0 && d1 < 0) || (d0 < 0 && d1 >= 0)) {
        crossingYs.push(y + (Math.abs(d0) / (Math.abs(d0) + Math.abs(d1) || 1)));
        break;
      }
    }
  }
  if (crossingYs.length < 2) return 0;
  return Math.max(...crossingYs) - Math.min(...crossingYs);
}

describe("MyBiome CurveMapper terrain profile", () => {
  const badPoints = [
    { In: 0, Out: 0 },
    { In: 0.25, Out: 0.35 },
    { In: 0.5, Out: 0.5 },
    { In: 0.75, Out: 0.65 },
    { In: 1, Out: 1 },
  ];

  const goodPoints = [
    { In: -80, Out: 1 },
    { In: -20, Out: 0.45 },
    { In: 0, Out: 0 },
    { In: 40, Out: -0.7 },
    { In: 120, Out: -1 },
  ];

  it("flags normalized curve with BaseHeight Distance in diagnostics", () => {
    const { nodes, edges } = jsonToGraph(makeMyBiomeTerrain(badPoints));
    const diags = analyzeGraph(nodes, edges);
    expect(
      diags.some((d) => d.code === "curvemapper-in-range-mismatch" && d.severity === "warning"),
    ).toBe(true);
  });

  it("flat surface with 0-1 curve on BaseHeight Distance", () => {
    const { nodes, edges } = jsonToGraph(makeMyBiomeTerrain(badPoints));
    expect(surfaceYSpreadAtSum(nodes, edges)).toBeLessThan(1);
  });

  it("varied surface with block-offset height profile curve", () => {
    const { nodes, edges } = jsonToGraph(makeMyBiomeTerrain(goodPoints));
    expect(surfaceYSpreadAtSum(nodes, edges)).toBeGreaterThan(2);
  });
});
