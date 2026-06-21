import {
  buildPrefabPreviewMesh,
  PREFAB_PREVIEW_BLOCK_CAP,
  type PrefabPreviewMeshData,
} from "@/utils/hytaleBlockAssets/buildPrefabPreviewMesh";
import { getHytaleBlockAssetIndex, readHytalePrefab, resolveHytaleBlockModels } from "@/utils/hytaleBlockAssets";
import type { PrefabJson } from "@/utils/hytaleBlockAssets/types";
import { resolvePrefabBlockColors } from "@/utils/hytaleBlockAssets/sampleBlockTextureColors";

export interface TexturedPrefabPreviewResult {
  mesh: PrefabPreviewMeshData;
  resolvedPath: string;
  entityCount: number;
  texturedBlockTypes: number;
  totalBlockTypes: number;
}

export interface LoadTexturedPrefabPreviewOptions {
  projectRoot?: string | null;
  renderCap?: number;
}

/**
 * Load a Hytale prefab with blocky-model geometry and RGB sampled from synced block textures.
 */
export async function loadTexturedPrefabPreview(
  relativePath: string,
  options?: LoadTexturedPrefabPreviewOptions,
): Promise<TexturedPrefabPreviewResult> {
  await getHytaleBlockAssetIndex();

  const { path, prefab } = await readHytalePrefab(relativePath, options?.projectRoot ?? null);
  const blockNames = [...new Set(prefab.blocks.map((b) => b.name))];
  const models = await resolveHytaleBlockModels(blockNames);
  const blockColors = await resolvePrefabBlockColors(models, { blockNames });
  const mesh = buildPrefabPreviewMesh(prefab, models, {
    blockColors,
    renderCap: options?.renderCap ?? PREFAB_PREVIEW_BLOCK_CAP,
  });

  return {
    mesh,
    resolvedPath: path,
    entityCount: Array.isArray(prefab.entities) ? prefab.entities.length : 0,
    texturedBlockTypes: Object.keys(blockColors).length,
    totalBlockTypes: blockNames.length,
  };
}

/** Build a textured prefab mesh from an already-loaded prefab JSON object. */
export async function loadTexturedPrefabFromJson(
  prefab: PrefabJson,
  options?: { renderCap?: number },
): Promise<Omit<TexturedPrefabPreviewResult, "resolvedPath"> & { resolvedPath: string | null }> {
  await getHytaleBlockAssetIndex();
  const blockNames = [...new Set(prefab.blocks.map((b) => b.name))];
  const models = await resolveHytaleBlockModels(blockNames);
  const blockColors = await resolvePrefabBlockColors(models, { blockNames });
  const mesh = buildPrefabPreviewMesh(prefab, models, {
    blockColors,
    renderCap: options?.renderCap ?? PREFAB_PREVIEW_BLOCK_CAP,
  });

  return {
    mesh,
    resolvedPath: null,
    entityCount: Array.isArray(prefab.entities) ? prefab.entities.length : 0,
    texturedBlockTypes: Object.keys(blockColors).length,
    totalBlockTypes: blockNames.length,
  };
}
