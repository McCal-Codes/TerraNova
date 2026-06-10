import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { stackBiomeSectionNodesForExport } from "../sectionExportOffsets";

describe("stackBiomeSectionNodesForExport", () => {
  it("preserves absolute coordinates for the first section", () => {
    const terrainNode: Node = {
      id: "n1",
      type: "Constant",
      position: { x: 40, y: 60 },
      data: { type: "Constant", fields: {} },
    };

    const stacked = stackBiomeSectionNodesForExport({
      Terrain: [terrainNode],
    });

    expect(stacked).toHaveLength(1);
    expect(stacked[0].position).toEqual({ x: 40, y: 60 });
  });

  it("offsets later biome sections below earlier ones in metadata space", () => {
    const terrainFrame: Node = {
      id: "f1",
      type: "frame",
      position: { x: 0, y: 0 },
      data: { type: "frame", name: "Terrain", width: 300, height: 200 },
    };
    const terrainNode: Node = {
      id: "n1",
      type: "Constant",
      position: { x: 40, y: 40 },
      data: {},
    };
    const materialFrame: Node = {
      id: "f2",
      type: "frame",
      position: { x: 0, y: 0 },
      data: { type: "frame", name: "Materials", width: 300, height: 200 },
    };

    const stacked = stackBiomeSectionNodesForExport({
      Terrain: [terrainFrame, terrainNode],
      MaterialProvider: [materialFrame],
    });

    const stackedMaterial = stacked.find((n) => n.id === "f2")!;
    expect(stackedMaterial.position.y).toBeGreaterThan(terrainFrame.position.y);

    const stackedTerrain = stacked.find((n) => n.id === "n1")!;
    expect(stackedTerrain.position).toEqual({ x: 40, y: 40 });
  });
});
