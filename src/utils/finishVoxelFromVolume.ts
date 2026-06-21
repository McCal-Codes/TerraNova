import type { Node, Edge } from "@xyflow/react";
import { createEvaluationContext } from "@/utils/densityEvaluator";
import { extractSurfaceVoxels, type FluidConfig, type VoxelData } from "@/utils/voxelExtractor";
import { resolveMaterials, DEFAULT_MATERIAL_PALETTE, matchMaterialName, type BiomeMaterialConfig } from "@/utils/materialResolver";
import { evaluateMaterialGraph } from "@/utils/materialEvaluator";
import { buildVoxelMeshes } from "@/utils/voxelMeshBuilder";
import { usePreviewStore } from "@/stores/previewStore";
import { computeDensityVolumeStats } from "@/utils/previewRootResolver";
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
    _voxelVolumeMaterialIds: materialIds ?? null,
    _voxelVolumeRes: result.resolution,
    _voxelVolumeYSlices: result.ySlices,
    surfaceVoxelCount: voxels.count,
    voxelDensityStats: computeDensityVolumeStats(densities),
    voxelMeshData: meshData,
    voxelDisplayedRes: result.resolution,
    ...(voxelEvalKey !== undefined ? { voxelEvalKey } : {}),
    ...(clearProgressRes ? { voxelEvalProgressRes: null } : {}),
  } as Partial<ReturnType<typeof usePreviewStore.getState>>);
}
