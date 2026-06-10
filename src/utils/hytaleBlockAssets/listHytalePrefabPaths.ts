import { join } from "@tauri-apps/api/path";
import { getHytaleAssetCacheRoot, listDirectory, pathExists } from "@/utils/ipc";
import { isTauriRuntime } from "@/utils/platform";
import { normalizePrefabRelativePath } from "./extractPrefabPath";

export const PREFAB_PATH_LIST_CAP = 8000;

function prefabRelativePath(dirPrefix: string, fileName: string): string | null {
  if (fileName.endsWith(".prefab.json")) {
    const stem = fileName.slice(0, -".prefab.json".length);
    const rel = dirPrefix ? `${dirPrefix}/${stem}` : stem;
    return normalizePrefabRelativePath(rel);
  }
  if (fileName.endsWith(".json")) {
    const stem = fileName.slice(0, -".json".length);
    const rel = dirPrefix ? `${dirPrefix}/${stem}` : stem;
    return normalizePrefabRelativePath(rel);
  }
  return null;
}

/** Walk a Server/Prefabs directory and collect relative paths (no extension). */
export async function collectPrefabPathsFromDirectory(
  prefabsRootAbs: string,
  dirPrefix: string,
  out: string[],
  cap = PREFAB_PATH_LIST_CAP,
): Promise<void> {
  if (out.length >= cap) return;
  if (!(await pathExists(prefabsRootAbs))) return;

  const entries = await listDirectory(prefabsRootAbs);
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (out.length >= cap) return;
    if (entry.is_dir) {
      const nextPrefix = dirPrefix ? `${dirPrefix}/${entry.name}` : entry.name;
      await collectPrefabPathsFromDirectory(entry.path, nextPrefix, out, cap);
      continue;
    }
    const rel = prefabRelativePath(dirPrefix, entry.name);
    if (rel) out.push(rel);
  }
}

export interface HytalePrefabPathCatalog {
  paths: string[];
  truncated: boolean;
  error: string | null;
}

/** List prefab paths from project pack Server/Prefabs then synced hytale-assets cache. */
export async function listHytalePrefabPaths(
  projectRoot: string | null,
): Promise<HytalePrefabPathCatalog> {
  if (!isTauriRuntime()) {
    return {
      paths: [],
      truncated: false,
      error: "Prefab catalog requires the TerraNova desktop app.",
    };
  }

  const seen = new Set<string>();
  const paths: string[] = [];
  const addUnique = (batch: string[]) => {
    for (const p of batch) {
      if (seen.has(p)) continue;
      seen.add(p);
      paths.push(p);
      if (paths.length >= PREFAB_PATH_LIST_CAP) return true;
    }
    return false;
  };

  try {
    if (projectRoot) {
      const projectPrefabs = await join(projectRoot, "Server", "Prefabs");
      const batch: string[] = [];
      await collectPrefabPathsFromDirectory(projectPrefabs, "", batch);
      if (addUnique(batch)) {
        paths.sort((a, b) => a.localeCompare(b));
        return { paths, truncated: true, error: null };
      }
    }

    const cacheRoot = await getHytaleAssetCacheRoot();
    const cachePrefabs = await join(cacheRoot, "Server", "Prefabs");
    const cacheBatch: string[] = [];
    await collectPrefabPathsFromDirectory(cachePrefabs, "", cacheBatch);
    addUnique(cacheBatch);
  } catch (err) {
    paths.sort((a, b) => a.localeCompare(b));
    return {
      paths,
      truncated: paths.length >= PREFAB_PATH_LIST_CAP,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  paths.sort((a, b) => a.localeCompare(b));
  return {
    paths,
    truncated: paths.length >= PREFAB_PATH_LIST_CAP,
    error: null,
  };
}
