import { describe, expect, it, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { evaluateDensityVolume } from "@/utils/volumeEvaluator";
import { enrichPreviewContentFields } from "@/utils/densityEvaluator";
import { extractSurfaceVoxels } from "@/utils/voxelExtractor";
import { analyzeGraphDefaults } from "@/utils/previewAutoFit";
import {
  HYTALE_SMOKE_BIOMES,
  buildHytaleTerrainSetup,
  countDensitySignBuckets,
  loadBiomeJsonSync,
  resolveHytaleCacheRoot,
  volumeHasSubsurfaceVoids,
  findTerrainOutputNode,
} from "@/dev/hytalePreviewSmokeLoader";
import { collectExternalImportedNames } from "@/utils/densityExportRegistry";
import { getHytaleGalleryCaseSetup, getTestFeaturesGalleryCaseSetup } from "@/dev/shapePreviewGalleryCases";
import { buildCellShapeGridForTarget } from "@/utils/shapePreview/buildCellShapeGridForTarget";
import { getNodeType } from "@/utils/density/evalTypes";
import { evaluateDensityGrid } from "@/utils/density/evaluateGrid";
import { TEST_FEATURES_PATCHES } from "@/dev/testFeaturesGalleryPatches";

const cacheRoot = resolveHytaleCacheRoot();
const hasCache = cacheRoot !== null;

function hytaleBiomeExists(rel: string): boolean {
  return cacheRoot !== null && existsSync(path.join(cacheRoot, rel.replace(/\//g, path.sep)));
}

const hasTestFeaturesBiome = hytaleBiomeExists(HYTALE_SMOKE_BIOMES.testFeatures);

describe.skipIf(!hasCache)("hytale voxel preview smoke (synced release assets)", () => {
  beforeAll(() => {
    if (!cacheRoot) return;
    for (const rel of Object.values(HYTALE_SMOKE_BIOMES)) {
      if (rel === HYTALE_SMOKE_BIOMES.testFeatures && !hytaleBiomeExists(rel)) continue;
      expect(() => loadBiomeJsonSync(cacheRoot, rel)).not.toThrow();
    }
  });

  it("Plains1_River: detects hydrography and imported river patterns", () => {
    const biome = loadBiomeJsonSync(cacheRoot!, HYTALE_SMOKE_BIOMES.plains1River);
    const setup = buildHytaleTerrainSetup(
      biome,
      cacheRoot!,
      HYTALE_SMOKE_BIOMES.plains1River,
    );

    expect(setup.features.importedRiverModule || setup.features.hydrography).toBe(true);
    expect(setup.features.terrainReference).toBe(true);
    expect(setup.materialConfig?.fluidMaterial).toMatch(/water/i);
    const unboundImports = collectExternalImportedNames(setup.nodes, setup.edges);
    if (unboundImports.length > 0) {
      expect(Object.keys(setup.externalDensityExports).length).toBeGreaterThan(0);
    }
  });

  it("Plains1_River: voxel volume has hills plus air/water channels", () => {
    const biome = loadBiomeJsonSync(cacheRoot!, HYTALE_SMOKE_BIOMES.plains1River);
    const setup = buildHytaleTerrainSetup(
      biome,
      cacheRoot!,
      HYTALE_SMOKE_BIOMES.plains1River,
    );
    const rootId = findTerrainOutputNode(setup.nodes) ?? setup.outputNodeId ?? undefined;
    const contentFields = enrichPreviewContentFields(setup.contentFields, -64, 64);

    const volume = evaluateDensityVolume(
      setup.nodes,
      setup.edges,
      48,
      -64,
      64,
      0,
      256,
      48,
      rootId,
      { contentFields, externalDensityExports: setup.externalDensityExports },
    );

    const buckets = countDensitySignBuckets(volume.densities);
    expect(buckets.nonNegative).toBeGreaterThan(100);
    expect(buckets.negative).toBeGreaterThan(100);
    expect(volume.maxValue).toBeGreaterThan(volume.minValue);

    const voxels = extractSurfaceVoxels(volume.densities, volume.resolution, volume.ySlices);
    expect(voxels.count).toBeGreaterThan(500);
  }, 20_000);

  it("Plains1_Deeproot: detects imported cave module", () => {
    const biome = loadBiomeJsonSync(cacheRoot!, HYTALE_SMOKE_BIOMES.plains1Deeproot);
    const setup = buildHytaleTerrainSetup(
      biome,
      cacheRoot!,
      HYTALE_SMOKE_BIOMES.plains1Deeproot,
    );

    expect(setup.features.importedCaveModule).toBe(true);
    expect(setup.features.undergroundCarving).toBe(true);
    expect(setup.externalDensityExports.Plains1_Caves_Deeproot_Terrain).toBeDefined();
  });

  it("Plains1_Deeproot: voxel volume shows subsurface voids (caves)", async () => {
    const biome = loadBiomeJsonSync(cacheRoot!, HYTALE_SMOKE_BIOMES.plains1Deeproot);
    const setup = buildHytaleTerrainSetup(
      biome,
      cacheRoot!,
      HYTALE_SMOKE_BIOMES.plains1Deeproot,
    );
    const rootId = findTerrainOutputNode(setup.nodes) ?? setup.outputNodeId ?? undefined;
    const contentFields = enrichPreviewContentFields(setup.contentFields, -64, 64);

    const defaults = analyzeGraphDefaults(
      setup.nodes,
      setup.edges,
      contentFields,
      { materialConfig: setup.materialConfig, rootNodeId: rootId },
    );
    const yMin = defaults.suggestedYMin;
    const yMax = defaults.suggestedYMax;

    const volume = evaluateDensityVolume(
      setup.nodes,
      setup.edges,
      48,
      -64,
      64,
      yMin,
      yMax,
      56,
      rootId,
      { contentFields, externalDensityExports: setup.externalDensityExports },
    );

    expect(volumeHasSubsurfaceVoids(volume.densities, volume.resolution, volume.ySlices)).toBe(
      true,
    );

    const voxels = extractSurfaceVoxels(volume.densities, volume.resolution, volume.ySlices);
    expect(voxels.count).toBeGreaterThan(200);
  }, 20_000);

  it("Desert1_River: detects hydrography or imported river module", () => {
    const biome = loadBiomeJsonSync(cacheRoot!, HYTALE_SMOKE_BIOMES.desert1River);
    const setup = buildHytaleTerrainSetup(
      biome,
      cacheRoot!,
      HYTALE_SMOKE_BIOMES.desert1River,
    );

    expect(setup.features.importedRiverModule || setup.features.hydrography).toBe(true);
    expect(setup.features.terrainReference).toBe(true);
  });

  it("Desert1_River: voxel volume has terrain surface + air channeling", () => {
    const biome = loadBiomeJsonSync(cacheRoot!, HYTALE_SMOKE_BIOMES.desert1River);
    const setup = buildHytaleTerrainSetup(
      biome,
      cacheRoot!,
      HYTALE_SMOKE_BIOMES.desert1River,
    );
    const rootId = findTerrainOutputNode(setup.nodes) ?? setup.outputNodeId ?? undefined;
    const contentFields = enrichPreviewContentFields(setup.contentFields, -64, 64);

    const defaults = analyzeGraphDefaults(
      setup.nodes,
      setup.edges,
      contentFields,
      { materialConfig: setup.materialConfig, rootNodeId: rootId },
    );

    const volume = evaluateDensityVolume(
      setup.nodes,
      setup.edges,
      48,
      -64,
      64,
      defaults.suggestedYMin,
      defaults.suggestedYMax,
      56,
      rootId,
      { contentFields, externalDensityExports: setup.externalDensityExports },
    );

    const buckets = countDensitySignBuckets(volume.densities);
    expect(buckets.nonNegative).toBeGreaterThan(100);
    expect(buckets.negative).toBeGreaterThan(100);

    const voxels = extractSurfaceVoxels(volume.densities, volume.resolution, volume.ySlices);
    expect(voxels.count).toBeGreaterThan(500);
  }, 20_000);

  it("Generative_Arches: gallery setup targets PCN with non-empty cell grid", () => {
    const biome = loadBiomeJsonSync(cacheRoot!, HYTALE_SMOKE_BIOMES.generativeArches);
    const setup = buildHytaleTerrainSetup(
      biome,
      cacheRoot!,
      HYTALE_SMOKE_BIOMES.generativeArches,
    );
    const gallery = getHytaleGalleryCaseSetup(
      "hytale-generative-arches",
      biome,
      setup.externalDensityExports,
    );
    expect(gallery.shapePreviewEnabled).toBe(true);
    expect(getNodeType(gallery.nodes.find((n) => n.id === gallery.previewNodeId)!)).toBe(
      "PositionsCellNoise",
    );

    const target = gallery.nodes.find((n) => n.id === gallery.previewNodeId)!;
    const grid = buildCellShapeGridForTarget(
      gallery.nodes,
      gallery.edges,
      target,
      -64,
      64,
      64,
      gallery.yLevel,
      gallery.externalDensityExports,
    );
    let edges = 0;
    for (let i = 0; i < grid!.edgeMask.length; i++) if (grid!.edgeMask[i]) edges++;
    expect(edges).toBeGreaterThan(0);
  });

  it("Desert1_Stacks: voxel volume has overhang-like surfaces", () => {
    const biome = loadBiomeJsonSync(cacheRoot!, HYTALE_SMOKE_BIOMES.desert1Stacks);
    const setup = buildHytaleTerrainSetup(
      biome,
      cacheRoot!,
      HYTALE_SMOKE_BIOMES.desert1Stacks,
    );
    const rootId = findTerrainOutputNode(setup.nodes) ?? setup.outputNodeId ?? undefined;
    const contentFields = enrichPreviewContentFields(setup.contentFields, -64, 64);

    const defaults = analyzeGraphDefaults(
      setup.nodes,
      setup.edges,
      contentFields,
      { materialConfig: setup.materialConfig, rootNodeId: rootId },
    );

    const volume = evaluateDensityVolume(
      setup.nodes,
      setup.edges,
      48,
      -64,
      64,
      defaults.suggestedYMin,
      defaults.suggestedYMax,
      56,
      rootId,
      { contentFields, externalDensityExports: setup.externalDensityExports },
    );

    const voxels = extractSurfaceVoxels(volume.densities, volume.resolution, volume.ySlices);
    expect(voxels.count).toBeGreaterThan(500);
  }, 20_000);

  it.skipIf(!hasCache || !hasTestFeaturesBiome)("Test_Features: resolves 56 Max-input patches for node UAT", () => {
    const biome = loadBiomeJsonSync(cacheRoot!, HYTALE_SMOKE_BIOMES.testFeatures);
    const setup = buildHytaleTerrainSetup(
      biome,
      cacheRoot!,
      HYTALE_SMOKE_BIOMES.testFeatures,
    );
    const gallery = getTestFeaturesGalleryCaseSetup(biome, setup.externalDensityExports);
    expect(gallery.testFeaturesPatches?.length).toBe(56);
    expect(getNodeType(gallery.nodes.find((n) => n.id === gallery.outputNodeId)!)).toBe("Max");

    const patch32 = gallery.testFeaturesPatches?.find((p) => p.index === 32);
    expect(patch32?.label).toMatch(/CellNoise2D/);

    const patchGallery = getTestFeaturesGalleryCaseSetup(
      biome,
      setup.externalDensityExports,
      "?patch=32",
    );
    expect(patchGallery.testFeaturesPatchIndex).toBe(32);
    expect(patchGallery.previewNodeId).toBe(patch32?.nodeId);

    const contentFields = {
      Base: 100,
      Water: 100,
      Bedrock: 0,
      previewOriginX: patch32!.x,
      previewOriginZ: patch32!.z,
    };
    const grid = evaluateDensityGrid(
      gallery.nodes,
      gallery.edges,
      48,
      -50,
      50,
      100,
      patch32!.nodeId,
      { contentFields },
    );
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < grid.values.length; i++) {
      if (grid.values[i]! < min) min = grid.values[i]!;
      if (grid.values[i]! > max) max = grid.values[i]!;
    }
    expect(max).toBeGreaterThan(min);
  });

  it("Test_Features: patch catalog count matches Hytale Max inputs", () => {
    expect(TEST_FEATURES_PATCHES).toHaveLength(56);
  });
});

describe("hytale voxel preview smoke (cache missing)", () => {
  it.skipIf(hasCache)("documents skip when hytale-assets cache is absent", () => {
    expect(cacheRoot).toBeNull();
  });
});
