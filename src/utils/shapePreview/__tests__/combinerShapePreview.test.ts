import { describe, expect, it } from "vitest";
import { getGalleryCaseSetup } from "@/dev/shapePreviewGalleryCases";
import { buildCellShapeGridForTarget } from "../buildCellShapeGridForTarget";
import { findUpstreamCellNoiseNodes } from "../combinerShapePreview";
import { getNodeType } from "@/utils/density/evalTypes";

describe("combiner shape preview", () => {
  it("underworld Max finds upstream CellNoise2D nodes and builds merged grid", () => {
    const setup = getGalleryCaseSetup("underworld-max");
    const maxNode = setup.nodes.find((n) => n.id === setup.outputNodeId)!;
    expect(getNodeType(maxNode)).toBe("Max");

    const upstream = findUpstreamCellNoiseNodes(setup.nodes, setup.edges, maxNode.id);
    expect(upstream.length).toBe(2);

    const grid = buildCellShapeGridForTarget(
      setup.nodes,
      setup.edges,
      maxNode,
      -64,
      64,
      64,
      setup.yLevel,
    );
    expect(grid?.resolution).toBe(64);
    let edgeCount = 0;
    for (let i = 0; i < grid!.edgeMask.length; i++) {
      if (grid!.edgeMask[i]) edgeCount++;
    }
    expect(edgeCount).toBeGreaterThan(20);
  });
});
