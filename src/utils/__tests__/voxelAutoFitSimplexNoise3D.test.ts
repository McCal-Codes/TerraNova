import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { evaluateDensityVolume } from "@/utils/volumeEvaluator";
import { extractSurfaceVoxels } from "@/utils/voxelExtractor";
import {
  resolveTerrainReferenceLevels,
  expandVoxelYBoundsToIncludeSurface,
} from "@/utils/terrainPreviewLevel";

function getNodesAndEdges(graph: unknown): { nodes: Node[]; edges: Edge[] } {
  const { nodes, edges } = jsonToGraph(graph as never);
  return { nodes, edges };
}

describe("voxel auto-fit Y bounds (SimplexNoise3D)", () => {
  it("re-expands around profile zero-crossing when anchored to Base Y", () => {
    const { nodes, edges } = getNodesAndEdges({
      Type: "Min",
      Inputs: [
        {
          Type: "CurveMapper",
          Curve: {
            Type: "Manual",
            Points: [
              { In: 0, Out: 1 },
              { In: 200, Out: -1 },
            ],
          },
          Inputs: [
            {
              Type: "BaseHeight",
              BaseHeightName: "Base",
              Distance: true,
            },
          ],
        },
        {
          Type: "Inverter",
          Inputs: [
            {
              Type: "SimplexNoise3D",
              Scale: 0.06,
              Persistence: 0.5,
              Lacunarity: 2.0,
              Octaves: 3,
              Seed: "caves3d",
            },
          ],
        },
      ],
    });

    const contentFields = { Base: 100, Bedrock: 0 };

    const baseRef = resolveTerrainReferenceLevels(nodes, edges, contentFields, { useBaseY: true });
    expect(baseRef).not.toBeNull();
    const profileRef = resolveTerrainReferenceLevels(nodes, edges, contentFields, { useBaseY: false });
    expect(profileRef).not.toBeNull();

    const resolution = 16;
    const rangeMin = -64;
    const rangeMax = 64;
    const ySlices = 24;

    function countMixedSlices(densities: Float32Array): number {
      const n = resolution;
      const totalPerSlice = n * n;
      let mixed = 0;
      for (let yi = 0; yi < ySlices; yi++) {
        const base = yi * n * n;
        let solid = 0;
        for (let i = 0; i < totalPerSlice; i++) {
          if (densities[base + i] >= 0) solid++;
        }
        if (solid > 0 && solid < totalPerSlice) mixed++;
      }
      return mixed;
    }

    // Simulate the "bad framing" case: voxel window ends below the profile-zero band.
    const initialYMin = 0;
    const targetY = profileRef!.suggestedYLevel; // profile-zero yLevel when not anchored
    const initialYMax = Math.max(1, Math.min(baseRef!.referenceY - 12, targetY - 1));

    // Apply our anchored-to-Base + profile-zero re-expansion logic.
    const expandedA = expandVoxelYBoundsToIncludeSurface(
      initialYMin,
      initialYMax,
      baseRef!,
      { anchorY: baseRef!.referenceY },
    );
    const expandedB = expandVoxelYBoundsToIncludeSurface(
      expandedA.worldYMin,
      expandedA.worldYMax,
      profileRef!,
      { anchorY: baseRef!.referenceY },
    );

    expect(expandedB.worldYMax).toBeGreaterThan(initialYMax);
    expect(expandedB.worldYMax).toBeGreaterThanOrEqual(Math.floor(targetY));

    const expanded = evaluateDensityVolume(
      nodes,
      edges,
      resolution,
      rangeMin,
      rangeMax,
      expandedB.worldYMin,
      expandedB.worldYMax,
      ySlices,
    );

    const expandedSurface = extractSurfaceVoxels(expanded.densities, expanded.resolution, expanded.ySlices);
    expect(expandedSurface.count).toBeGreaterThan(0);

    // Basic signal that the expanded volume includes both solid and air slices.
    expect(countMixedSlices(expanded.densities)).toBeGreaterThan(0);
  });
});

