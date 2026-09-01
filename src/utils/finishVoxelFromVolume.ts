import type { Node, Edge } from "@xyflow/react";
import { createEvaluationContext } from "@/utils/densityEvaluator";
import {
  extractSurfaceVoxels,
  type CutawayVolume,
  type FluidConfig,
  type VoxelData,
} from "@/utils/voxelExtractor";
import { resolveMaterials, DEFAULT_MATERIAL_PALETTE, matchMaterialName, type BiomeMaterialConfig } from "@/utils/materialResolver";
import { evaluateMaterialGraph } from "@/utils/materialEvaluator";
import { buildVoxelMeshes } from "@/utils/voxelMeshBuilder";
import { usePreviewStore } from "@/stores/previewStore";
import { computeDensityVolumeStats } from "@/utils/previewRootResolver";
import { buildVoidClassMaterials } from "@/utils/voidClassification";
import type { VolumeEvalResult } from "@/utils/volumeWorkerClient";
import {
  resolveVoxelMaterialGraph,
  voxelMaterialGraphHasEvaluator,
  type VoxelMaterialGraph,
} from "@/utils/voxelMaterialPreview";

export interface FinishVoxelInput {
  nodes: Node[];
  edges: Edge[];
  result: VolumeEvalResult;
  rangeMin: number;
  rangeMax: number;
  voxelYMin: number;
  voxelYMax: number;
  yLevel: number;
  rootNodeId?: string;
  contentFields: Record<string, number>;
  materialConfig?: BiomeMaterialConfig | null;
  /** Biome MaterialProvider section used when the active canvas is terrain-only. */
  biomeSections?: Record<string, { nodes: Node[]; edges: Edge[] }> | null;
  showMaterialColors: boolean;
  evalOptions: { contentFields: Record<string, number> };
  /** When false, leave voxelEvalProgressRes for the caller (progressive mid-pass). */
  clearProgressRes?: boolean;
  /** Fast path: shape-only mesh, skip material graph and fluid plane. */
  previewPass?: boolean;
  /** Stored on the preview store when the mesh matches current inputs. */
  voxelEvalKey?: string;
}

function resolveHiddenMaterialIndices(
  palette: Array<{ name: string; color: string }>,
  hiddenNames: string[],
): Set<number> {
  const hidden = new Set<number>();
  for (const name of hiddenNames) {
    const idx = palette.findIndex((entry) => entry.name === name);
    if (idx >= 0) hidden.add(idx);
  }
  return hidden;
}

function buildMeshFromVoxelCache(
  voxels: VoxelData,
  densities: Float32Array,
  resolution: number,
  ySlices: number,
  materialIds: Uint8Array | undefined,
  hiddenNames: string[],
  palette: Array<{ name: string; color: string }>,
) {
  const sceneSize = 50;
  const meshScaleX = sceneSize / resolution;
  const meshScaleZ = sceneSize / resolution;
  const meshScaleY = sceneSize / Math.max(resolution, ySlices);
  const meshOffsetX = -sceneSize / 2;
  const meshOffsetZ = -sceneSize / 2;
  const meshOffsetY = -sceneSize / 2;
  const hiddenIndices = resolveHiddenMaterialIndices(palette, hiddenNames);
  return buildVoxelMeshes(
    voxels,
    densities,
    resolution,
    ySlices,
    meshScaleX,
    meshScaleY,
    meshScaleZ,
    meshOffsetX,
    meshOffsetY,
    meshOffsetZ,
    materialIds,
    hiddenIndices,
  );
}

/**
 * Swap material colouring for void-class colouring when the void view is on.
 *
 * Rides the existing material pipeline: the mesh builder groups by material index and
 * the legend reads the palette, so replacing both is enough — no mesh changes needed.
 * Returns null when the void view is off, so callers keep their material result.
 */
function resolveVoidViewMaterials(
  densities: Float32Array,
  resolution: number,
  ySlices: number,
): { materialIds: Uint8Array; palette: Array<{ name: string; color: string }>; enclosed: number; breaching: number } | null {
  if (!usePreviewStore.getState().showVoidView) return null;
  const { materialIds, palette, classification } = buildVoidClassMaterials(densities, resolution, ySlices);
  return {
    materialIds,
    palette,
    enclosed: classification.enclosedCount,
    breaching: classification.breachingCount,
  };
}

/** Rebuild voxel mesh after legend visibility toggles (uses cached volume). */
export function rebuildVoxelMeshFromCache(): void {
  const state = usePreviewStore.getState();
  if (!state._voxelSurfaceData || !state.voxelDensities || state._voxelVolumeRes == null || state._voxelVolumeYSlices == null) {
    return;
  }
  const meshData = buildMeshFromVoxelCache(
    state._voxelSurfaceData,
    state.voxelDensities,
    state._voxelVolumeRes,
    state._voxelVolumeYSlices,
    state._voxelVolumeMaterialIds ?? undefined,
    state.hiddenVoxelMaterialNames,
    state.voxelPalette,
  );
  usePreviewStore.getState().setVoxelMeshData(meshData);
}

/**
 * Re-extract surface voxels for a cutaway and rebuild the mesh.
 *
 * Runs off the cached density volume, so the density graph is never re-evaluated —
 * this is a geometry pass only, cheap enough to run on cutaway release.
 *
 * Re-extraction rather than a GPU clip plane is what makes the cut read as solid
 * rock: extraction only emits solid voxels adjacent to air, so clipping a shell
 * exposes a hollow interior, whereas passing the cut bounds into extraction turns the
 * cut faces into boundary-adjacent surface and caps them.
 *
 * Pass `undefined` to restore the full uncut volume.
 */
export function reextractVoxelsWithCutaway(cutaway: CutawayVolume | undefined): void {
  const state = usePreviewStore.getState();
  const densities = state.voxelDensities;
  const res = state._voxelVolumeRes;
  const ys = state._voxelVolumeYSlices;
  if (!densities || res == null || ys == null) return;

  const voidView = resolveVoidViewMaterials(densities, res, ys);
  const materialIds = voidView?.materialIds ?? state._voxelVolumeMaterialIds ?? undefined;
  const palette = voidView?.palette ?? state.voxelPalette;

  const voxels = extractSurfaceVoxels(
    densities,
    res,
    ys,
    materialIds,
    palette,
    state._voxelFluidConfig ?? undefined,
    cutaway,
  );

  const meshData = buildMeshFromVoxelCache(
    voxels,
    densities,
    res,
    ys,
    materialIds,
    state.hiddenVoxelMaterialNames,
    palette,
  );

  usePreviewStore.setState({
    _voxelSurfaceData: voxels,
    surfaceVoxelCount: voxels.count,
    voxelMeshData: meshData,
    ...(voidView ? { voxelPalette: palette, voidStats: { enclosed: voidView.enclosed, breaching: voidView.breaching } } : {}),
  } as Partial<ReturnType<typeof usePreviewStore.getState>>);
}

/** Full voxel post-process: backing fill → materials → mesh → preview store. */
export function finishVoxelFromVolume(input: FinishVoxelInput): void {
  const {
    nodes,
    edges,
    result,
    rangeMin,
    rangeMax,
    voxelYMin,
    voxelYMax,
    rootNodeId,
    materialConfig,
    biomeSections,
    showMaterialColors,
    evalOptions,
    clearProgressRes = true,
    previewPass = false,
    voxelEvalKey,
  } = input;

  const densities = result.densities;

  usePreviewStore.getState().setVoxelDensities(densities);

  let materialIds: Uint8Array | undefined;
  let palette = DEFAULT_MATERIAL_PALETTE;

  if (showMaterialColors) {
    const materialGraph: VoxelMaterialGraph = resolveVoxelMaterialGraph({
      nodes,
      edges,
      biomeSections,
    });
    const useMaterialEvaluator = !previewPass && voxelMaterialGraphHasEvaluator(materialGraph);

    if (useMaterialEvaluator) {
      const densityCtx = createEvaluationContext(
        nodes,
        edges,
        rootNodeId,
        evalOptions,
      );
      const matResult = evaluateMaterialGraph(
        materialGraph.nodes,
        materialGraph.edges,
        densities,
        result.resolution,
        result.ySlices,
        rangeMin,
        rangeMax,
        voxelYMin,
        voxelYMax,
        densityCtx ?? undefined,
      );
      if (matResult) {
        materialIds = matResult.materialIds;
        palette = matResult.palette;
      }
    }

    if (!materialIds) {
      const matResult = resolveMaterials(
        densities,
        result.resolution,
        result.ySlices,
        undefined,
        materialConfig ?? undefined,
        { worldYMin: voxelYMin, worldYMax: voxelYMax },
      );
      materialIds = matResult.materialIds;
      palette = matResult.palette;
    }
  }

  // Void view overrides material colouring entirely — it answers a different
  // question, and mixing the two palettes would make neither readable.
  const voidView = resolveVoidViewMaterials(densities, result.resolution, result.ySlices);
  if (voidView) {
    materialIds = voidView.materialIds;
    palette = voidView.palette;
  }

  let fluidCfg: FluidConfig | undefined;
  if (!previewPass && materialConfig?.fluidLevel != null && materialConfig.fluidMaterial) {
    const yRange = voxelYMax - voxelYMin;
    const fluidSlice = yRange > 0
      ? Math.round(((materialConfig.fluidLevel - voxelYMin) / yRange) * result.ySlices)
      : 0;
    const fluidMatName = materialConfig.fluidMaterial;
    let fluidIdx = palette.findIndex((m) => m.name === fluidMatName);
    if (fluidIdx < 0) {
      fluidIdx = palette.length;
      palette = [...palette, { name: fluidMatName, color: matchMaterialName(fluidMatName) }];
    }
    if (fluidSlice >= 0 && fluidSlice < result.ySlices) {
      fluidCfg = { fluidLevel: fluidSlice, fluidMaterialIndex: fluidIdx };
    }
  }

  if (fluidCfg) {
    const sceneSize = 50;
    const meshScaleY = sceneSize / Math.max(result.resolution, result.ySlices);
    const meshOffsetY = -sceneSize / 2;
    const fluidY = meshOffsetY + (fluidCfg.fluidLevel * meshScaleY);
    const fluidMatName = materialConfig?.fluidMaterial ?? "";
    const isLava = fluidMatName.toLowerCase().includes("lava");
    usePreviewStore.getState().setFluidPlaneConfig({
      type: isLava ? "lava" : "water",
      yPosition: fluidY,
    });
  } else if (!previewPass) {
    usePreviewStore.getState().setFluidPlaneConfig(null);
  }

  const voxels = extractSurfaceVoxels(
    densities,
    result.resolution,
    result.ySlices,
    materialIds,
    palette,
    fluidCfg,
  );

  usePreviewStore.getState().setVoxelMaterials(voxels.materialIds, voxels.materials);

  const hiddenNames = usePreviewStore.getState().hiddenVoxelMaterialNames;
  const meshData = buildMeshFromVoxelCache(
    voxels,
    densities,
    result.resolution,
    result.ySlices,
    materialIds,
    hiddenNames,
    palette,
  );

  usePreviewStore.setState({
    _voxelSurfaceData: voxels,
    _voxelFluidConfig: fluidCfg ?? null,
    _voxelVolumeMaterialIds: materialIds ?? null,
    _voxelVolumeRes: result.resolution,
    _voxelVolumeYSlices: result.ySlices,
    surfaceVoxelCount: voxels.count,
    voidStats: voidView ? { enclosed: voidView.enclosed, breaching: voidView.breaching } : null,
    voxelDensityStats: computeDensityVolumeStats(densities),
    voxelMeshData: meshData,
    voxelDisplayedRes: result.resolution,
    ...(voxelEvalKey !== undefined ? { voxelEvalKey } : {}),
    ...(clearProgressRes ? { voxelEvalProgressRes: null } : {}),
  } as Partial<ReturnType<typeof usePreviewStore.getState>>);
}
