import { describe, expect, it } from "vitest";
import type { ImportMetadata } from "../hytaleToInternal";
import {
  collectBiomeSectionNodeIds,
  discoverBiomeSectionKeys,
  routeGroupToSection,
  splitImportMetadataBySection,
} from "../sectionAnnotationRouting";

describe("discoverBiomeSectionKeys", () => {
  it("lists biome tabs present in a wrapper", () => {
    const keys = discoverBiomeSectionKeys({
      Terrain: { Density: { Type: "Constant", Value: 0 } },
      MaterialProvider: { Type: "Constant", Material: "Rock_Stone" },
      Props: [{ Positions: { Type: "Constant" } }],
      EnvironmentProvider: { Type: "Constant", Environment: "default" },
      TintProvider: { Type: "Constant", Color: "#fff" },
    });
    expect(keys).toEqual([
      "Terrain",
      "MaterialProvider",
      "Props[0]",
      "EnvironmentProvider",
      "TintProvider",
    ]);
  });
});

describe("collectBiomeSectionNodeIds", () => {
  it("collects __hytaleNodeId from internalized biome subtrees", () => {
    const wrapper = {
      Terrain: {
        Density: {
          Type: "Sum",
          __hytaleNodeId: "Min.Density-abc",
          Inputs: [
            { Type: "Constant", __hytaleNodeId: "Max.Density-def", Value: 1 },
          ],
        },
      },
    };
    const ids = collectBiomeSectionNodeIds(wrapper);
    expect(ids.Terrain).toEqual(new Set(["Min.Density-abc", "Max.Density-def"]));
  });
});

describe("splitImportMetadataBySection", () => {
  const metadata: ImportMetadata = {
    comments: {},
    nodeIds: {},
    nodePositions: {},
    nodeEditorMetadata: { $Comments: [], $Groups: [] },
    hytaleComments: [
      { text: "roof note", x: 10, y: 10, width: 100, height: 80 },
    ],
    hytaleGroups: [
      { name: "Terrain", x: 0, y: 0, width: 500, height: 400 },
      { name: "Materials", x: 0, y: 500, width: 300, height: 200 },
      { name: "Roof", x: 0, y: 0, width: 120, height: 120 },
    ],
  };

  const sectionKeys = ["Terrain", "MaterialProvider", "EnvironmentProvider"];

  it("routes named Hytale groups to matching TerraNova tabs", () => {
    const slices = splitImportMetadataBySection(metadata, sectionKeys);
    expect(slices.get("Terrain")?.hytaleGroups.map((g) => g.name)).toEqual(["Terrain", "Roof"]);
    expect(slices.get("MaterialProvider")?.hytaleGroups.map((g) => g.name)).toEqual(["Materials"]);
    expect(slices.get("EnvironmentProvider")?.hytaleGroups).toEqual([]);
  });

  it("places comments inside a group on that group's section", () => {
    const slices = splitImportMetadataBySection(metadata, sectionKeys);
    expect(slices.get("Terrain")?.hytaleComments).toHaveLength(1);
    expect(slices.get("MaterialProvider")?.hytaleComments).toHaveLength(0);
  });

  it("routes community-style labels by $Nodes overlap inside the frame", () => {
    const communityMetadata: ImportMetadata = {
      comments: {},
      nodeIds: {},
      nodePositions: {
        "terrain-node-1": { x: 900, y: 900 },
        "mat-node-1": { x: 50, y: 60 },
        "prop-node-1": { x: 1100, y: 1100 },
      },
      nodeEditorMetadata: { $Comments: [], $Groups: [] },
      hytaleComments: [],
      hytaleGroups: [
        { name: "Grass", x: 0, y: 0, width: 200, height: 200 },
        { name: "Trees", x: 1000, y: 1000, width: 220, height: 220 },
      ],
    };
    const wrapper = {
      Terrain: {
        Density: { Type: "Constant", $NodeId: "terrain-node-1", Value: 0 },
      },
      MaterialProvider: {
        Type: "Constant",
        $NodeId: "mat-node-1",
        Material: "Grass_Block",
      },
      Props: [
        {
          Positions: { Type: "Constant", $NodeId: "prop-node-1" },
        },
      ],
    };

    const slices = splitImportMetadataBySection(
      communityMetadata,
      ["Terrain", "MaterialProvider", "Props[0]"],
      wrapper,
    );

    expect(slices.get("MaterialProvider")?.hytaleGroups.map((g) => g.name)).toEqual(["Grass"]);
    expect(slices.get("Props[0]")?.hytaleGroups.map((g) => g.name)).toEqual(["Trees"]);
    expect(slices.get("Terrain")?.hytaleGroups).toEqual([]);
  });
});

describe("routeGroupToSection", () => {
  it("prefers explicit section titles when spatial overlap is weak", () => {
    const section = routeGroupToSection(
      { name: "Materials", x: 0, y: 0, width: 100, height: 100 },
      ["Terrain", "MaterialProvider"],
      {
        Terrain: new Set(["n1"]),
        MaterialProvider: new Set(["n2"]),
      },
      {
        n1: { x: 10, y: 10 },
        n2: { x: 0, y: 0 },
      },
    );
    expect(section).toBe("MaterialProvider");
  });
});
