import { join } from "@tauri-apps/api/path";
import { getHytaleAssetCacheRoot, listDirectory, pathExists } from "@/utils/ipc";
import { HYTALE_KNOWN_ENVIRONMENTS } from "@/utils/graphDiagnostics";
import { isTauriRuntime } from "@/utils/platform";

export const HYTALE_ENVIRONMENT_LIST_CAP = 2000;

const FALLBACK_ENVIRONMENT_IDS = [...HYTALE_KNOWN_ENVIRONMENTS].sort((a, b) =>
  a.localeCompare(b),
);

export interface HytaleEnvironmentIdCatalog {
  ids: string[];
  source: "cache" | "fallback";
  error: string | null;
}

/** List Env_* IDs from synced Hytale Server/Environments (falls back to known built-ins). */
export async function listHytaleEnvironmentIds(): Promise<HytaleEnvironmentIdCatalog> {
  if (!isTauriRuntime()) {
    return { ids: FALLBACK_ENVIRONMENT_IDS, source: "fallback", error: null };
  }

  try {
    const cacheRoot = await getHytaleAssetCacheRoot();
    const envDir = await join(cacheRoot, "Server", "Environments");
    if (!(await pathExists(envDir))) {
      return {
        ids: FALLBACK_ENVIRONMENT_IDS,
        source: "fallback",
        error: "Sync Hytale assets to populate the environment list.",
      };
    }

    const entries = await listDirectory(envDir);
    const ids = entries
      .filter((entry) => !entry.is_dir && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => entry.name.replace(/\.json$/i, ""))
      .filter((id) => id.startsWith("Env_"))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, HYTALE_ENVIRONMENT_LIST_CAP);

    if (ids.length === 0) {
      return {
        ids: FALLBACK_ENVIRONMENT_IDS,
        source: "fallback",
        error: "No Env_*.json files found in the synced cache.",
      };
    }

    return { ids, source: "cache", error: null };
  } catch (err) {
    return {
      ids: FALLBACK_ENVIRONMENT_IDS,
      source: "fallback",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
