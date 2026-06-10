import type { PrefabJson, ResolvedBlockModel } from "./types";
import {
  clearHytaleBlockAssetCache as clearServiceCache,
  readPrefabFromPaths,
  resolveHytaleBlockModels as resolveViaService,
} from "./hytaleBlockAssetService";

export type HytalePrefabJson = PrefabJson;

export interface ReadPrefabResponse {
  path: string;
  prefab: HytalePrefabJson;
}

export async function resolveHytaleBlockModels(
  blockNames: string[],
): Promise<Record<string, ResolvedBlockModel | null>> {
  if (blockNames.length === 0) return {};
  return resolveViaService(blockNames);
}

export async function readHytalePrefab(
  relativePath: string,
  projectRoot?: string | null,
): Promise<ReadPrefabResponse> {
  const loaded = await readPrefabFromPaths(relativePath, projectRoot);
  if (!loaded) {
    throw new Error(`Prefab not found: ${relativePath}`);
  }
  return { path: loaded.resolvedPath, prefab: loaded.prefab };
}

export function clearHytaleBlockAssetCache(): void {
  clearServiceCache();
}
