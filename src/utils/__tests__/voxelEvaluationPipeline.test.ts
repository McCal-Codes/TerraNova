import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { evaluateDensityVolume } from "@/utils/volumeEvaluator";
import { extractSurfaceVoxels, fillTerrainColumnBacking } from "@/utils/voxelExtractor";
import { buildVoxelMeshes } from "@/utils/voxelMeshBuilder";

function makeNode(id: string, type: string, fields: Record<string, unknown> = {}): Node {
  return {
    id,
    type: "generic",
    position: { x: 0, y: 0 },
    data: { type, fields, label: type },
  };
}

describe("voxel evaluation pipeline", () => {
  it("evaluates a Min + inverted noise cave graph end-to-end", () => {
    const nodes = [
      makeNode("bh", "BaseHeight", { BaseHeightName: "Base" }),
      makeNode("noise", "SimplexNoise3D", { Scale: 0.04 }),
      makeNode("inv", "Inverter"),
      makeNode("min", "Min"),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "bh", target: "min", targetHandle: "Inputs[0]" },
      { id: "e2", source: "noise", target: "inv", targetHandle: "Input" },
      { id: "e3", source: "inv", target: "min", targetHandle: "Inputs[1]" },
    ];

    const volume = evaluateDensityVolume(
      nodes,
      edges,
      16,
      -32,
      32,
      0,
      128,
      24,
      "min",
      { contentFields: { Base: 64 } },
    );

    expect(volume.densities.length).toBe(16 * 16 * 24);
    expect(volume.maxValue).toBeGreaterThan(volume.minValue);

    const backed = fillTerrainColumnBacking(volume.densities, volume.resolution, volume.ySlices);
    const voxels = extractSurfaceVoxels(backed, volume.resolution, volume.ySlices);
    expect(voxels.count).toBeGreaterThan(0);

    const meshes = buildVoxelMeshes(
      voxels,
      backed,
      volume.resolution,
      volume.ySlices,
      50 / volume.resolution,
      50 / Math.max(volume.resolution, volume.ySlices),
      50 / volume.resolution,
      -25,
      -25,
      -25,
    );
    expect(meshes.length).toBeGreaterThan(0);
    expect(meshes[0].positions.length).toBeGreaterThan(0);
  });

  it("handles CellWallDistance downstream of CellNoise2D without throwing", () => {
    const nodes = [
      makeNode("cn", "CellNoise2D", { Scale: 8, Seed: 1 }),
      makeNode("cwd", "CellWallDistance"),
      makeNode("sum", "Sum"),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "cn", target: "sum", targetHandle: "Inputs[0]" },
      { id: "e2", source: "cwd", target: "sum", targetHandle: "Inputs[1]" },
    ];

    const volume = evaluateDensityVolume(nodes, edges, 8, -16, 16, 0, 64, 8, "sum");
    expect(volume.densities.some((v) => v !== 0)).toBe(true);
  });
});
