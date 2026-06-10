import { describe, it, expect } from "vitest";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { createEvaluationContext } from "@/utils/densityEvaluator";
import {
  computeTerrainAutoFitYBounds,
  sampleTerrainSurfaceCrossings,
} from "@/utils/terrainPreviewLevel";

/** Matches release Examples/Example_Curve_Mapper.json and MyBiome terrain stack. */
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

describe("terrain voxel fidelity (Hytale Manual curve)", () => {
  const contentFields = { Base: 100, Bedrock: 0 };

  it("crosses zero near base + height profile zero distance", () => {
    const { nodes, edges } = jsonToGraph(makeExampleCurveMapperTerrain());
    const sumNode = nodes.find((n) => (n.data as { type: string }).type === "Sum")!;
    const ctx = createEvaluationContext(nodes, edges, sumNode.id, { contentFields })!;
    const wx = 0;
    const wz = 0;
    const d150 = ctx.evaluate(sumNode.id, wx, 150, wz);
    const d210 = ctx.evaluate(sumNode.id, wx, 210, wz);
    expect(d150).toBeGreaterThan(0);
    expect(d210).toBeLessThan(0);
  });

  it("surface band matches height profile zero at base + 100 blocks", () => {
    const { nodes, edges } = jsonToGraph(makeExampleCurveMapperTerrain());
    const sample = sampleTerrainSurfaceCrossings(nodes, edges, contentFields);
    expect(sample).not.toBeNull();
    expect(sample!.medianSurfaceY).toBeGreaterThan(170);
    expect(sample!.medianSurfaceY).toBeLessThan(220);
    expect(sample!.minSurfaceY).toBeGreaterThan(90);
    expect(sample!.maxSurfaceY - sample!.minSurfaceY).toBeLessThan(120);
  });

  it("auto-fit window frames nominal surface near base + profile zero", () => {
    const { nodes, edges } = jsonToGraph(makeExampleCurveMapperTerrain());
    const bounds = computeTerrainAutoFitYBounds(nodes, edges, contentFields);
    expect(bounds).not.toBeNull();
    expect(bounds!.yLevel).toBeGreaterThan(170);
    expect(bounds!.yLevel).toBeLessThan(220);
    expect(bounds!.worldYMax - bounds!.worldYMin).toBeLessThan(140);
    expect(bounds!.worldYMin).toBeGreaterThanOrEqual(120);
    expect(bounds!.worldYMax).toBeLessThanOrEqual(250);
  });
});
