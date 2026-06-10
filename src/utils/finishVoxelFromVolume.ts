import type { Node, Edge } from "@xyflow/react";
import { createEvaluationContext } from "@/utils/densityEvaluator";
import { extractSurfaceVoxels, fillTerrainColumnBacking, type FluidConfig } from "@/utils/voxelExtractor";
import { resolveMaterials, DEFAULT_MATERIAL_PALETTE, matchMaterialName, type BiomeMaterialConfig } from "@/utils/materialResolver";
import { evaluateMaterialGraph } from "@/utils/materialEvaluator";
import { buildVoxelMeshes } from "@/utils/voxelMeshBuilder";
import { getNodeType } from "@/utils/density/evalTypes";
import { usePreviewStore } from "@/stores/previewStore";
import type { VolumeEvalResult } from "@/utils/volumeWorkerClient";

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
  showMaterialColors: boolean;
  evalOptions: { contentFields: Record<string, number> };
  /** When false, leave voxelEvalProgressRes for the caller (progressive mid-pass). */
  clearProgressRes?: boolean;
  /** Fast path: shape-only mesh, skip material graph and fluid plane. */
  previewPass?: boolean;
  /** Stored on the preview store when the mesh matches current inputs. */
  voxelEvalKey?: string;
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
    showMaterialColors,
    evalOptions,
    clearProgressRes = true,
    previewPass = false,
    voxelEvalKey,
  } = input;

  const backedDensities = fillTerrainColumnBacking(
    result.densities,
    result.resolution,
    result.ySlices,
  );

  usePreviewStore.getState().setVoxelDensities(backedDensities);

  let materialIds: Uint8Array | undefined;
  let palette = DEFAULT_MATERIAL_PALETTE;

  if (showMaterialColors) {
    const hasMaterialGraph = !previewPass && nodes.some((n) => getNodeType(n).startsWith("Material:"));

    if (hasMaterialGraph) {
      const densityCtx = createEvaluationContext(
        nodes,
        edges,
        rootNodeId,
        evalOptions,
      );
      const matResult = evaluateMaterialGraph(
        nodes, edges, backedDensities,
        result.resolution, result.ySlices,
        rangeMin, rangeMax, voxelYMin, voxelYMax,
        densityCtx ?? undefined,
      );
      if (matResult) {
        materialIds = matResult.materialIds;
        palette = matResult.palette;
      }
    }

    if (!materialIds) {
      const matResult = resolveMaterials(
        backedDensities,
        result.resolution,
        result.ySlices,
        undefined,
        materialConfig ?? undefined,
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
    backedDensities,
    result.resolution,
    result.ySlices,
    materialIds,
    palette,
    fluidCfg,
  );

  usePreviewStore.getState().setVoxelMaterials(voxels.materialIds, voxels.materials);

  const sceneSize = 50;
  const meshScaleX = sceneSize / result.resolution;
  const meshScaleZ = sceneSize / result.resolution;
  const meshScaleY = sceneSize / Math.max(result.resolution, result.ySlices);
  const meshOffsetX = -sceneSize / 2;
  const meshOffsetZ = -sceneSize / 2;
  const meshOffsetY = -sceneSize / 2;

  const meshData = buildVoxelMeshes(
    voxels,
    backedDensities,
    result.resolution,
    result.ySlices,
    meshScaleX, meshScaleY, meshScaleZ,
    meshOffsetX, meshOffsetY, meshOffsetZ,
    materialIds,
  );

  usePreviewStore.setState({
    _voxelData: voxels,
    _voxelVolumeRes: result.resolution,
    _voxelVolumeYSlices: result.ySlices,
    surfaceVoxelCount: voxels.count,
    voxelMeshData: meshData,
    voxelDisplayedRes: result.resolution,
    ...(voxelEvalKey !== undefined ? { voxelEvalKey } : {}),
    ...(clearProgressRes ? { voxelEvalProgressRes: null } : {}),
  } as Partial<ReturnType<typeof usePreviewStore.getState>>);
}
