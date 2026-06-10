import { checkHytaleAssetStaleness, getHytaleAssetCacheRoot, syncHytaleAssets, type AssetStalenessInfo, type HytaleAssetSyncResult } from "@/utils/ipc";
import { clearBlockIconCache } from "@/utils/blockIconUrl";
import { clearBlockTextureColorCache } from "@/utils/hytaleBlockAssets/sampleBlockTextureColors";
import { clearHytaleBlockAssetCache } from "@/utils/hytaleBlockAssets";
import { clearAvailableHytaleAssetFoldersCache } from "@/utils/hytaleAssetFolders";
import { clearHytaleAssetsInFolderCache } from "@/utils/getHytaleAssetsInFolder";
import { clearRuntimeDensityExportCache } from "@/utils/densityExportRegistry";
import { invalidatePrefabPathCatalog } from "@/utils/hytaleBlockAssets/prefabPathCatalogCache";
import { isTauriRuntime } from "@/utils/platform";

export interface RunHytaleAssetSyncParams {
  sourcePath: string;
  commonOverlayEnabled?: boolean;
  commonOverlayPath?: string | null;
}

export interface RunHytaleAssetSyncOutcome {
  result: HytaleAssetSyncResult;
  cacheRoot: string;
  staleness: AssetStalenessInfo | null;
}

function clearHytaleAssetCaches(): void {
  clearAvailableHytaleAssetFoldersCache("hytale-assets");
  clearHytaleAssetsInFolderCache("hytale-assets");
  clearRuntimeDensityExportCache();
  clearBlockIconCache();
  clearBlockTextureColorCache();
  clearHytaleBlockAssetCache();
  invalidatePrefabPathCatalog();
}

export function assertHytaleAssetSyncReady(params: RunHytaleAssetSyncParams): void {
  if (!isTauriRuntime()) {
    throw new Error("Hytale asset sync is available in the TerraNova desktop app.");
  }
  if (!params.sourcePath.trim()) {
    throw new Error("Choose a Hytale asset source path first.");
  }
  if (params.commonOverlayEnabled && !params.commonOverlayPath?.trim()) {
    throw new Error("Choose a Common asset overlay path or turn it off.");
  }
}

export async function runHytaleAssetSync(
  params: RunHytaleAssetSyncParams,
): Promise<RunHytaleAssetSyncOutcome> {
  assertHytaleAssetSyncReady(params);

  const result = await syncHytaleAssets(
    params.sourcePath,
    params.commonOverlayEnabled ? params.commonOverlayPath ?? null : null,
  );
  clearHytaleAssetCaches();

  const cacheRoot = await getHytaleAssetCacheRoot();
  let staleness: AssetStalenessInfo | null = null;
  try {
    staleness = await checkHytaleAssetStaleness(params.sourcePath);
  } catch {
    staleness = null;
  }

  return { result, cacheRoot, staleness };
}

export function formatHytaleSyncToast(result: HytaleAssetSyncResult): string {
  const overlaySummary = result.commonOverlayFilesWritten > 0
    ? ` plus ${result.commonOverlayFilesWritten} Common overlay file${result.commonOverlayFilesWritten === 1 ? "" : "s"}`
    : "";
  return `Synced ${result.filesWritten} Hytale asset file${result.filesWritten === 1 ? "" : "s"}${overlaySummary} into the TerraNova cache.`;
}
