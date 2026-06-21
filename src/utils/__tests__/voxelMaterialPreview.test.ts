import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { hytaleToInternalBiome } from "@/utils/hytaleToInternal";
import { evaluateDensityVolume } from "@/utils/volumeEvaluator";
import { enrichPreviewContentFields } from "@/utils/densityEvaluator";
import { extractMaterialConfig, resolveMaterials } from "@/utils/materialResolver";
import { evaluateMaterialGraph } from "@/utils/materialEvaluator";
import { extractSurfaceVoxels, SOLID_THRESHOLD } from "@/utils/voxelExtractor";
import { resolvePreviewRoot } from "@/utils/previewRootResolver";
import {
  resolveVoxelMaterialGraph,
  voxelMaterialGraphHasEvaluator,
} from "@/utils/voxelMaterialPreview";

const MY_BIOME_PATH =
  "c:/Users/wolft/AppData/Roaming/Hytale/UserData/Saves/Worldgen V1/mods/DevMcCal.TestingTerranova/Server/HytaleGenerator/Biomes/MyBiome.json";

const hasBiome = existsSync(MY_BIOME_PATH);

function loadMyBiomeSections() {
  const biome = JSON.parse(readFileSync(MY_BIOME_PATH, "utf8"));
  const { wrapper } = hytaleToInternalBiome(biome);
  const terrain = wrapper.Terrain as Record<string, unknown>;
  const density = terrain.Density as Record<string, unknown>;
  const terrainGraph = jsonToGraph(density, 0, 0, "terrain");
  if (terrainGraph.nodes.length > 0) {
    const rootNode = terrainGraph.nodes[terrainGraph.nodes.length - 1]!;
    rootNode.data = {
      ...(rootNode.data as Record<string, unknown>),
      _outputNode: true,
      _biomeField: "Terrain",
    };
  }

  const matProvider = wrapper.MaterialProvider as Record<string, unknown>;
  const materialGraph = jsonToGraph(matProvider, 0, 0, "mat", "MaterialProvider");
  if (materialGraph.nodes.length > 0) {
    const rootNode = materialGraph.nodes[materialGraph.nodes.length - 1]!;
    rootNode.data = {
      ...(rootNode.data as Record<string, unknown>),
      _outputNode: true,
    };
  }

  return {
    wrapper,
    terrainNodes: terrainGraph.nodes,
    terrainEdges: terrainGraph.edges,
    materialNodes: materialGraph.nodes,
    materialEdges: materialGraph.edges,
    materialConfig: extractMaterialConfig(wrapper),
  };
}

describe.skipIf(!hasBiome)("voxel material preview (MyBiome)", () => {
  it("extractMaterialConfig resolves Rock_Stone from Queue Constant provider", () => {
    const { materialConfig } = loadMyBiomeSections();
    expect(materialConfig).not.toBeNull();
    expect(materialConfig!.layers.some((l) => l.material === "Rock_Stone" || l.solidMaterial === "Rock_Stone")).toBe(true);
  });

  it("uses MaterialProvider section while editing terrain canvas", () => {
    const { terrainNodes, terrainEdges, materialNodes, materialEdges } = loadMyBiomeSections();
    const graph = resolveVoxelMaterialGraph({
      nodes: terrainNodes,
      edges: terrainEdges,
      biomeSections: {
        MaterialProvider: { nodes: materialNodes, edges: materialEdges },
      },
    });
    expect(graph.source).toBe("material-section");
    expect(voxelMaterialGraphHasEvaluator(graph)).toBe(true);
  });

  it("material graph assigns Rock_Stone to surface voxels", () => {
    const {
      terrainNodes,
      terrainEdges,
      materialNodes,
      materialEdges,
      materialConfig,
    } = loadMyBiomeSections();
    const root = resolvePreviewRoot({ nodes: terrainNodes, edges: terrainEdges });
    const contentFields = { Base: 100, Bedrock: 0, Water: 62 };
    const yMin = 50;
    const yMax = 180;
    const evalOpts = {
      contentFields: enrichPreviewContentFields(contentFields, -64, 64, 100),
    };
    const vol = evaluateDensityVolume(
      terrainNodes,
      terrainEdges,
      32,
      -64,
      64,
      yMin,
      yMax,
      32,
      root.nodeId!,
      evalOpts,
    );

    const matGraph = resolveVoxelMaterialGraph({
      nodes: terrainNodes,
      edges: terrainEdges,
      biomeSections: {
        MaterialProvider: { nodes: materialNodes, edges: materialEdges },
      },
    });
    const matResult = evaluateMaterialGraph(
      matGraph.nodes,
      matGraph.edges,
      vol.densities,
      vol.resolution,
      vol.ySlices,
      -64,
      64,
      yMin,
      yMax,
    );
    expect(matResult).not.toBeNull();
    const stoneIdx = matResult!.palette.findIndex((m) => m.name === "Rock_Stone");
    expect(stoneIdx).toBeGreaterThanOrEqual(0);

    const voxels = extractSurfaceVoxels(vol.densities, vol.resolution, vol.ySlices, matResult!.materialIds, matResult!.palette);
    expect(voxels.count).toBeGreaterThan(0);
    for (let i = 0; i < voxels.count; i++) {
      expect(voxels.materialIds[i]).toBe(stoneIdx);
    }

    const fallback = resolveMaterials(
      vol.densities,
      vol.resolution,
      vol.ySlices,
      undefined,
      materialConfig ?? undefined,
      { worldYMin: yMin, worldYMax: yMax },
    );
    expect(fallback.palette.some((m) => m.name === "Rock_Stone")).toBe(true);
    let solidCount = 0;
    for (let i = 0; i < vol.densities.length; i++) {
      if (vol.densities[i]! >= SOLID_THRESHOLD) solidCount++;
    }
    expect(solidCount).toBeGreaterThan(0);
  });
});

describe("voxelMaterialPreview", () => {
  it("prefers canvas material nodes over biome section", () => {
    const nodes = [
      { id: "m1", type: "Material:Constant", position: { x: 0, y: 0 }, data: { type: "Material:Constant", fields: { Material: "Soil_Grass" } } },
      { id: "d1", type: "Sum", position: { x: 0, y: 0 }, data: { type: "Sum" } },
    ];
    const edges: never[] = [];
    const graph = resolveVoxelMaterialGraph({
      nodes,
      edges,
      biomeSections: {
        MaterialProvider: {
          nodes: [{ id: "x", type: "Material:Constant", position: { x: 0, y: 0 }, data: { type: "Material:Constant", fields: { Material: "Rock_Stone" } } }],
          edges: [],
        },
      },
    });
    expect(graph.source).toBe("canvas");
  });
});

describe("extractMaterialConfig Solidity envelope", () => {
  it("unwraps Solid branch materials", () => {
    const config = extractMaterialConfig({
      MaterialProvider: {
        Type: "Solidity",
        Solid: {
          Type: "Constant",
          Material: { Solid: "Soil_Grass" },
        },
      },
    });
    expect(config?.layers[0]?.material).toBe("Soil_Grass");
  });
});
