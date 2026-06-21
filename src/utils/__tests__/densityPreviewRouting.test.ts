import { describe, it, expect } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { previewTargetNeedsVoxel } from "@/utils/densityPreviewRouting";
import { buildDensityBasicsCase } from "@/utils/densityBasics/showcase";

function makeNode(id: string, type: string): Node {
  return {
    id,
    type: "generic",
    position: { x: 0, y: 0 },
    data: { type, fields: {}, label: type },
  };
}

describe("densityPreviewRouting", () => {
  it("needs voxel for 3D noise preview root", () => {
    const { nodes, edges, previewNodeId } = buildDensityBasicsCase("density-noise-3d");
    const result = previewTargetNeedsVoxel(nodes, edges, previewNodeId);
    expect(result.needsVoxel).toBe(true);
  });

  it("does not need voxel for pure 2D noise", () => {
    const { nodes, edges, previewNodeId } = buildDensityBasicsCase("density-noise-2d");
    const result = previewTargetNeedsVoxel(nodes, edges, previewNodeId);
    expect(result.needsVoxel).toBe(false);
  });

  it("does not need voxel for sum-2d (2D noise only in subtree)", () => {
    const { nodes, edges, previewNodeId } = buildDensityBasicsCase("density-sum-2d");
    const result = previewTargetNeedsVoxel(nodes, edges, previewNodeId);
    expect(result.needsVoxel).toBe(false);
  });

  it("needs voxel for min-carve preview target", () => {
    const { nodes, edges, previewNodeId } = buildDensityBasicsCase("density-min-carve");
    const result = previewTargetNeedsVoxel(nodes, edges, previewNodeId);
    expect(result.needsVoxel).toBe(true);
  });

  it("ignores unrelated cave branch when previewing isolated 2D noise", () => {
    const nodes = [
      makeNode("noise2d", "SimplexNoise2D"),
      makeNode("noise3d", "SimplexNoise3D"),
      makeNode("min", "Min"),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "noise3d", target: "min", sourceHandle: "output", targetHandle: "Inputs[1]" },
      { id: "e2", source: "noise2d", target: "min", sourceHandle: "output", targetHandle: "Inputs[0]" },
    ];
    const result = previewTargetNeedsVoxel(nodes, edges, "noise2d");
    expect(result.needsVoxel).toBe(false);
  });
});
