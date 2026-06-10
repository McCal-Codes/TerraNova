import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { jsonToGraph } from "../jsonToGraph";
import { createEvaluationContext } from "../densityEvaluator";
import { analyzeGraph } from "../graphDiagnostics";
import { sumHasRawNoisePlusHeightCurveMapper } from "../sumTerrainPattern";

/** Release Examples/Example_Curve_Mapper.json terrain stack. */
function makeExampleCurveMapperTerrain() {
  return {
    Type: "Sum",
    Inputs: [
      {
        Type: "CurveMapper",
        Curve: {
          Type: "Manual",
          Points: [
            { In: -1, Out: -0.1 },
            { In: 0, Out: 0 },
            { In: 1, Out: 1 },
          ],
        },
        Inputs: [{
          Type: "SimplexNoise2D",
          Lacunarity: 2,
          Octaves: 1,
          Persistence: 0.5,
          Scale: 100,
          Seed: "A",
        }],
      },
      {
        Type: "CurveMapper",
        Curve: {
          Type: "Manual",
          Points: [
            { In: 0, Out: 1 },
            { In: 200, Out: -1 },
          ],
        },
        Inputs: [{
          Type: "BaseHeight",
          BaseHeightName: "Base",
          Distance: true,
        }],
      },
    ],
  };
}

function makeRawNoisePlusHeightTerrain() {
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
        Curve: {
          Type: "Manual",
          Points: [
            { In: -80, Out: 1 },
            { In: 0, Out: 0 },
            { In: 120, Out: -1 },
          ],
        },
        Inputs: [{
          Type: "BaseHeight",
          BaseHeightName: "Base",
          Distance: true,
        }],
      },
    ],
  };
}

/** Fraction of X columns solid at a depth below reference surface (Base=100). */
function undergroundSolidFraction(
  nodes: Node[],
  edges: Edge[],
  sampleY: number,
  contentFields: Record<string, number>,
): number {
  const sumNode = nodes.find((n) => (n.data as { type: string }).type === "Sum")!;
  const ctx = createEvaluationContext(nodes, edges, sumNode.id, { contentFields })!;
  let solid = 0;
  const columns = 16;
  for (let xi = 0; xi < columns; xi++) {
    const wx = -128 + xi * 16;
    if (ctx.evaluate(sumNode.id, wx, sampleY, 0) >= 0) solid += 1;
  }
  return solid / columns;
}

describe("Example_Curve_Mapper terrain stack", () => {
  const fields = { Base: 100, BaseHeight: 100 };

  it("flags raw noise + height CurveMapper anti-pattern", () => {
    const { nodes, edges } = jsonToGraph(makeRawNoisePlusHeightTerrain());
    const sumNode = nodes.find((n) => (n.data as { type: string }).type === "Sum")!;
    expect(sumHasRawNoisePlusHeightCurveMapper(sumNode.id, nodes, edges)).toBe(true);
    const diags = analyzeGraph(nodes, edges);
    expect(diags.some((d) => d.code === "sum-raw-noise-height-curvemapper")).toBe(true);
  });

  it("does not flag nested noise CurveMapper pattern", () => {
    const { nodes, edges } = jsonToGraph(makeExampleCurveMapperTerrain());
    const sumNode = nodes.find((n) => (n.data as { type: string }).type === "Sum")!;
    expect(sumHasRawNoisePlusHeightCurveMapper(sumNode.id, nodes, edges)).toBe(false);
  });

  it("keeps most columns solid below surface (continuous ground)", () => {
    const { nodes, edges } = jsonToGraph(makeExampleCurveMapperTerrain());
    const frac = undergroundSolidFraction(nodes, edges, 50, fields);
    expect(frac).toBeGreaterThan(0.85);
  });

  it("example pattern is more continuous near the surface than raw noise sum", () => {
    const exampleNodes = jsonToGraph(makeExampleCurveMapperTerrain());
    const rawNodes = jsonToGraph(makeRawNoisePlusHeightTerrain());
    const exampleFrac = undergroundSolidFraction(exampleNodes.nodes, exampleNodes.edges, 105, fields);
    const rawFrac = undergroundSolidFraction(rawNodes.nodes, rawNodes.edges, 105, fields);
    expect(exampleFrac).toBeGreaterThan(rawFrac);
  });
});
