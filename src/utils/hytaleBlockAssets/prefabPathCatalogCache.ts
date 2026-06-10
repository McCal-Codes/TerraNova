import {
  listHytalePrefabPaths,
  type HytalePrefabPathCatalog,
} from "./listHytalePrefabPaths";

const EMPTY: HytalePrefabPathCatalog = { paths: [], truncated: false, error: null };

type CacheEntry = {
  catalog: HytalePrefabPathCatalog;
  promise: Promise<HytalePrefabPathCatalog> | null;
};

const cache = new Map<string, CacheEntry>();

function cacheKey(projectRoot: string | null): string {
  return projectRoot ?? "__no_project__";
}

export function invalidatePrefabPathCatalog(projectRoot?: string | null): void {
  if (projectRoot === undefined) {
    cache.clear();
    return;
  }
  cache.delete(cacheKey(projectRoot));
}

export function peekPrefabPathCatalog(projectRoot: string | null): HytalePrefabPathCatalog | null {
  const entry = cache.get(cacheKey(projectRoot));
  if (!entry || entry.promise) return null;
  return entry.catalog;
}

/** Shared prefab path listing — one in-flight scan per project root. */
export function getPrefabPathCatalog(projectRoot: string | null): Promise<HytalePrefabPathCatalog> {
  const key = cacheKey(projectRoot);
  let entry = cache.get(key);
  if (!entry) {
    const promise = listHytalePrefabPaths(projectRoot).then((catalog) => {
      const current = cache.get(key);
      if (current) {
        current.catalog = catalog;
        current.promise = null;
      }
      return catalog;
    });
    entry = { catalog: EMPTY, promise };
    cache.set(key, entry);
    return promise;
  }
  if (entry.promise) return entry.promise;
  return Promise.resolve(entry.catalog);
}
