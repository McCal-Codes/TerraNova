import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import {
  mergeBiomeSectionNodesForHytaleExport,
  prepareBiomeSectionNodesForExport,
  stackBiomeSectionNodesForExport,
} from "../sectionExportOffsets";

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

  it("restores global Hytale coordinates without vertical stacking", () => {
    const terrainNode: Node = {
      id: "n1",
      type: "Constant",
      position: { x: 180, y: 280 },
      data: { type: "Constant", fields: {} },
    };
    const materialNode: Node = {
      id: "n2",
      type: "Constant",
      position: { x: 220, y: 340 },
      data: { type: "Constant", fields: {} },
    };

    const merged = mergeBiomeSectionNodesForHytaleExport(
      { Terrain: [terrainNode], MaterialProvider: [materialNode] },
      {
        Terrain: { x: 80, y: 80 },
        MaterialProvider: { x: 120, y: 140 },
      },
    );

    expect(merged).toHaveLength(2);
    expect(merged[0].position).toEqual({ x: 100, y: 200 });
    expect(merged[1].position).toEqual({ x: 100, y: 200 });
  });

  it("uses hytale merge path when import layout mode is hytale", () => {
    const terrainNode: Node = {
      id: "n1",
      type: "Constant",
      position: { x: 180, y: 280 },
      data: {},
    };

    const prepared = prepareBiomeSectionNodesForExport(
      { Terrain: [terrainNode] },
      "hytale",
      { Terrain: { x: 80, y: 80 } },
    );

    expect(prepared[0].position).toEqual({ x: 100, y: 200 });
  });
});
