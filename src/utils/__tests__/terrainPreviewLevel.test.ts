import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { jsonToGraph } from "@/utils/jsonToGraph";
import {
  computeTerrainAutoFitYBounds,
  discoverContentFieldsForBiome,
  inferBiomeNameFromFile,
  parseContentFieldsFromWorldStructure,
  resolveTerrainReferenceLevels,
  expandVoxelYBoundsToIncludeSurface,
  sampleTerrainSurfaceCrossings,
  worldStructureReferencesBiome,
  worldStructuresDirFromBiomePath,
} from "@/utils/terrainPreviewLevel";
import { mergeScanWithTerrainAutoFit } from "@/utils/previewAutoFit";

function makeNode(id: string, type: string, fields: Record<string, unknown> = {}): Node {
  return {
    id,
    type: "generic",
    position: { x: 0, y: 0 },
    data: { type, fields, label: type },
  };
}

describe("parseContentFieldsFromWorldStructure", () => {
  it("reads Hytale { Name, Y } ContentFields", () => {
    const fields = parseContentFieldsFromWorldStructure({
      ContentFields: [
        { Type: "BaseHeight", Name: "Base", Y: 100 },
        { Type: "BaseHeight", Name: "Bedrock", Y: 0 },
      ],
    });
    expect(fields).toEqual({ Base: 100, Bedrock: 0 });
  });

  it("reads legacy { Name, Value } ContentFields", () => {
    const fields = parseContentFieldsFromWorldStructure({
      ContentFields: [{ Name: "Water", Value: 64 }],
    });
    expect(fields).toEqual({ Water: 64 });
  });
});

describe("worldStructureReferencesBiome", () => {
  it("matches DefaultBiome and Biomes entries", () => {
    expect(worldStructureReferencesBiome({ DefaultBiome: "MyBiome" }, "MyBiome")).toBe(true);
    expect(
      worldStructureReferencesBiome({ Biomes: [{ Biome: "Hills", Min: -1, Max: 1 }] }, "Hills"),
    ).toBe(true);
    expect(worldStructureReferencesBiome({ DefaultBiome: "Other" }, "MyBiome")).toBe(false);
  });
});

describe("discoverContentFieldsForBiome", () => {
  it("prefers biome-named world structure and parses Y fields", async () => {
    const files: Record<string, unknown> = {
      "C:/mod/Server/HytaleGenerator/WorldStructures/MyBiome.json": {
        ContentFields: [{ Name: "Base", Y: 100 }, { Name: "Bedrock", Y: 0 }],
      },
      "C:/mod/Server/HytaleGenerator/WorldStructures/MainWorld.json": {
        ContentFields: [{ Name: "Base", Y: 64 }],
      },
    };

    const fields = await discoverContentFieldsForBiome(
      "C:/mod/Server/HytaleGenerator/Biomes/MyBiome.json",
      "MyBiome",
      async (path) => files[path.replace(/\\/g, "/")],
      async () => [
        { name: "MyBiome.json", path: "C:/mod/Server/HytaleGenerator/WorldStructures/MyBiome.json", is_dir: false },
        { name: "MainWorld.json", path: "C:/mod/Server/HytaleGenerator/WorldStructures/MainWorld.json", is_dir: false },
      ],
    );

    expect(fields).toEqual({ Base: 100, Bedrock: 0 });
  });
});

describe("resolveTerrainReferenceLevels", () => {
  it("uses height profile zero-crossing above ContentFields base", () => {
    const nodes = [
      makeNode("bh", "BaseHeight", { BaseHeightName: "Base", Distance: true }),
      makeNode("cm", "CurveMapper", {}),
      makeNode("curve", "Manual", {
        Points: [
          { In: 0, Out: 1 },
          { In: 200, Out: -1 },
        ],
      }),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "bh", target: "cm", targetHandle: "Input" },
      { id: "e2", source: "curve", target: "cm", targetHandle: "Curve" },
    ];

    const levels = resolveTerrainReferenceLevels(nodes, edges, { Base: 100, Bedrock: 0 });
    expect(levels).not.toBeNull();
    expect(levels!.referenceY).toBe(100);
    expect(levels!.suggestedYLevel).toBe(200);
    expect(levels!.suggestedYMin).toBe(150);
    expect(levels!.reason).toContain("profile zero at +100");
  });

  it("respects bedrock when limiting below padding", () => {
    const nodes = [makeNode("bh", "BaseHeight", { BaseHeightName: "Base", Distance: true })];
    const levels = resolveTerrainReferenceLevels(nodes, [], { Base: 100, Bedrock: 0 });
    expect(levels!.suggestedYMin).toBeGreaterThanOrEqual(50);
  });

  it("anchors to ContentFields Base Y when useBaseY is enabled", () => {
    const nodes = [
      makeNode("bh", "BaseHeight", { BaseHeightName: "Base", Distance: true }),
      makeNode("cm", "CurveMapper", {}),
      makeNode("curve", "Manual", {
        Points: [
          { In: 0, Out: 1 },
          { In: 200, Out: -1 },
        ],
      }),
    ];
    const edges: Edge[] = [
      { id: "e1", source: "bh", target: "cm", targetHandle: "Input" },
      { id: "e2", source: "curve", target: "cm", targetHandle: "Curve" },
    ];

    const levels = resolveTerrainReferenceLevels(nodes, edges, { Base: 100, Bedrock: 0 }, {
      useBaseY: true,
    });
    expect(levels).not.toBeNull();
    expect(levels!.suggestedYLevel).toBe(100);
    expect(levels!.reason).toContain("anchored to Base Y");
  });
});

describe("sampleTerrainSurfaceCrossings", () => {
  it("finds a surface band for canonical CurveMapper Sum stack", () => {
    const { nodes, edges } = jsonToGraph({
      Type: "Sum",
      Inputs: [
        {
          Type: "SimplexNoise2D",
          Scale: 100,
          Octaves: 1,
          Seed: "A",
        },
        {
          Type: "CurveMapper",
          Curve: {
            Type: "Manual",
            Points: [{ In: 0, Out: 1 }, { In: 200, Out: -1 }],
          },
          Inputs: [{
            Type: "BaseHeight",
            BaseHeightName: "Base",
            Distance: true,
          }],
        },
      ],
    });
    const sample = sampleTerrainSurfaceCrossings(nodes, edges, { Base: 100 });
    expect(sample).not.toBeNull();
    expect(sample!.sampleCount).toBeGreaterThan(0);
    expect(sample!.minSurfaceY).toBeGreaterThan(60);
    expect(sample!.maxSurfaceY).toBeLessThan(240);
    expect(sample!.maxSurfaceY - sample!.minSurfaceY).toBeGreaterThan(2);
    expect(sample!.rawMaxSurfaceY).toBeGreaterThan(sample!.maxSurfaceY);
  });
});

describe("computeTerrainAutoFitYBounds", () => {
  it("tightens Y window to probed surface span", () => {
    const { nodes, edges } = jsonToGraph({
      Type: "Sum",
      Inputs: [
        {
          Type: "SimplexNoise2D",
          Scale: 100,
          Octaves: 1,
          Seed: "A",
        },
        {
          Type: "CurveMapper",
          Curve: {
            Type: "Manual",
            Points: [{ In: 0, Out: 1 }, { In: 200, Out: -1 }],
          },
          Inputs: [{
            Type: "BaseHeight",
            BaseHeightName: "Base",
            Distance: true,
          }],
        },
      ],
    });
    const bounds = computeTerrainAutoFitYBounds(nodes, edges, { Base: 100, Bedrock: 0 });
    expect(bounds).not.toBeNull();
    expect(bounds!.worldYMax - bounds!.worldYMin).toBeLessThan(140);
    expect(bounds!.yLevel).toBeGreaterThan(80);
    expect(bounds!.yLevel).toBeLessThan(240);
  });

  it("uses Base Y for yLevel when useBaseY is enabled", () => {
    const { nodes, edges } = jsonToGraph({
      Type: "Sum",
      Inputs: [
        {
          Type: "SimplexNoise2D",
          Scale: 100,
          Octaves: 1,
          Seed: "A",
        },
        {
          Type: "CurveMapper",
          Curve: {
            Type: "Manual",
            Points: [{ In: 0, Out: 1 }, { In: 200, Out: -1 }],
          },
          Inputs: [{
            Type: "BaseHeight",
            BaseHeightName: "Base",
            Distance: true,
          }],
        },
      ],
    });
    const bounds = computeTerrainAutoFitYBounds(nodes, edges, { Base: 100, Bedrock: 0 }, {
      useBaseY: true,
    });
    expect(bounds).not.toBeNull();
    expect(bounds!.yLevel).toBe(100);
    expect(bounds!.reason).toContain("anchored to Base Y");
  });
});

describe("mergeScanWithTerrainAutoFit", () => {
  it("prefers tighter terrain band when coarse scan is much wider", () => {
    const terrain = {
      worldYMin: 80,
      worldYMax: 150,
      yLevel: 110,
      reason: "test",
    };
    const merged = mergeScanWithTerrainAutoFit(
      { worldYMin: 0, worldYMax: 256, hasSolids: true },
      terrain,
    );
    expect(merged.worldYMin).toBe(80);
    expect(merged.worldYMax).toBe(150);
  });

  it("expands scan when it is already close to terrain band", () => {
    const terrain = {
      worldYMin: 80,
      worldYMax: 150,
      yLevel: 110,
      reason: "test",
    };
    const merged = mergeScanWithTerrainAutoFit(
      { worldYMin: 75, worldYMax: 155, hasSolids: true },
      terrain,
    );
    expect(merged.worldYMin).toBe(75);
    expect(merged.worldYMax).toBe(155);
  });

  it("expands a scan window clipped below the terrain surface band", () => {
    const terrain = {
      worldYMin: 50,
      worldYMax: 150,
      yLevel: 100,
      reason: "test",
    };
    const merged = mergeScanWithTerrainAutoFit(
      { worldYMin: 0, worldYMax: 88, hasSolids: true },
      terrain,
    );
    expect(merged.worldYMin).toBe(0);
    expect(merged.worldYMax).toBe(150);
  });
});

describe("expandVoxelYBoundsToIncludeSurface", () => {
  it("raises Y max when it sits below ContentFields Base Y", () => {
    const levels = resolveTerrainReferenceLevels(
      [makeNode("bh", "BaseHeight", { BaseHeightName: "Base", Distance: true })],
      [],
      { Base: 100, Bedrock: 0 },
      { useBaseY: true },
    )!;
    const expanded = expandVoxelYBoundsToIncludeSurface(0, 88, levels, { anchorY: 100 });
    expect(expanded.worldYMax).toBeGreaterThan(100);
    expect(expanded.worldYMin).toBeLessThan(100);
  });
});

describe("path helpers", () => {
  it("derives WorldStructures dir from biome path", () => {
    expect(
      worldStructuresDirFromBiomePath("C:/mod/Server/HytaleGenerator/Biomes/MyBiome.json"),
    ).toBe("C:/mod/Server/HytaleGenerator/WorldStructures");
  });

  it("infers biome name from wrapper or filename", () => {
    expect(inferBiomeNameFromFile({ Name: "Custom" }, "Biomes/MyBiome.json")).toBe("Custom");
    expect(inferBiomeNameFromFile({}, "Biomes/MyBiome.json")).toBe("MyBiome");
  });
});
