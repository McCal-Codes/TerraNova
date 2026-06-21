import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { hytaleToInternalBiome } from "@/utils/hytaleToInternal";
import { evaluateDensityVolume } from "@/utils/volumeEvaluator";
import { enrichPreviewContentFields } from "@/utils/densityEvaluator";
import { createEvaluationContext } from "@/utils/densityEvaluator";
import { resolvePreviewRoot, computeDensityVolumeStats } from "@/utils/previewRootResolver";
import {
  expandVoxelYBoundsToIncludeSurface,
  resolveTerrainReferenceLevels,
} from "@/utils/terrainPreviewLevel";
import { extractSurfaceVoxels } from "@/utils/voxelExtractor";

const MY_BIOME_PATH =
  "c:/Users/wolft/AppData/Roaming/Hytale/UserData/Saves/Worldgen V1/mods/DevMcCal.TestingTerranova/Server/HytaleGenerator/Biomes/MyBiome.json";

const hasBiome = existsSync(MY_BIOME_PATH);

function loadTerrainSectionLikeApp() {
  const biome = JSON.parse(readFileSync(MY_BIOME_PATH, "utf8"));
  const { wrapper } = hytaleToInternalBiome(biome);
  const terrain = wrapper.Terrain as Record<string, unknown>;
  const density = terrain.Density as Record<string, unknown>;
  const { nodes, edges } = jsonToGraph(density, 0, 0, "terrain");
  if (nodes.length > 0) {
    const rootNode = nodes[nodes.length - 1]!;
    rootNode.data = {
      ...(rootNode.data as Record<string, unknown>),
      _outputNode: true,
      _biomeField: "Terrain",
    };
  }
  const outputNodeId = nodes.length > 0 ? nodes[nodes.length - 1]!.id : null;
  return { nodes, edges, outputNodeId };
}

describe.skipIf(!hasBiome)("MyBiome terrain section preview root", () => {
  it("CellNoise jitter clamp allows air in voxel volume (not a solid cube)", () => {
    const { nodes, edges, outputNodeId } = loadTerrainSectionLikeApp();
    const contentFields = { Base: 100, Bedrock: 0, Water: 62 };
    const evalOpts = {
      contentFields: enrichPreviewContentFields(contentFields, -64, 64, 100),
    };
    const root = resolvePreviewRoot({ nodes, edges, outputNodeId });
    expect(root.nodeType).toBe("Sum");

    const ctx = createEvaluationContext(nodes, edges, root.nodeId!, evalOpts)!;
    const d150 = ctx.evaluate(root.nodeId!, 0, 150, 0);
    const d250 = ctx.evaluate(root.nodeId!, 0, 250, 0);
    expect(d150).toBeGreaterThan(0);
    expect(d250).toBeLessThan(0);

    const terrainRef = resolveTerrainReferenceLevels(nodes, edges, contentFields, { useBaseY: true });
    const profileRef = resolveTerrainReferenceLevels(nodes, edges, contentFields, { useBaseY: false });
    expect(terrainRef).not.toBeNull();
    expect(profileRef).not.toBeNull();

    let yMin = 50;
    let yMax = 134;
    const expandedA = expandVoxelYBoundsToIncludeSurface(yMin, yMax, terrainRef!, { anchorY: 100 });
    const expandedB = expandVoxelYBoundsToIncludeSurface(
      expandedA.worldYMin,
      expandedA.worldYMax,
      profileRef!,
      { anchorY: 100 },
    );
    yMin = expandedB.worldYMin;
    yMax = expandedB.worldYMax;

    const vol = evaluateDensityVolume(
      nodes,
      edges,
      48,
      -64,
      64,
      yMin,
      yMax,
      48,
      root.nodeId!,
      evalOpts,
    );
    const stats = computeDensityVolumeStats(vol.densities);
    expect(stats.min).toBeLessThan(0);
    expect(stats.max).toBeGreaterThan(0);
    expect(stats.positiveFraction).toBeLessThan(0.95);
    expect(stats.positiveFraction).toBeGreaterThan(0.05);

    const voxels = extractSurfaceVoxels(vol.densities, vol.resolution, vol.ySlices);
    expect(voxels.count).toBeGreaterThan(50);
    expect(voxels.count).toBeLessThan(48 * 48 * 48);
  });
});
