import { useEffect, useState } from "react";
import { getPrefabPathCatalog } from "@/utils/hytaleBlockAssets/prefabPathCatalogCache";
import type { HytalePrefabPathCatalog } from "@/utils/hytaleBlockAssets/listHytalePrefabPaths";

const EMPTY: HytalePrefabPathCatalog = { paths: [], truncated: false, error: null };

/** Pick parent-provided catalog or fall back to hook state. */
export function selectPrefabCatalog(
  hook: HytalePrefabPathCatalog & { loading: boolean },
  catalogProp?: HytalePrefabPathCatalog,
  catalogLoadingProp?: boolean,
): { catalog: HytalePrefabPathCatalog; loading: boolean } {
  if (catalogProp !== undefined) {
    return { catalog: catalogProp, loading: catalogLoadingProp ?? false };
  }
  return {
    catalog: { paths: hook.paths, truncated: hook.truncated, error: hook.error },
    loading: hook.loading,
  };
}

export function usePrefabPathCatalog(
  projectRoot: string | null,
  enabled = true,
): HytalePrefabPathCatalog & { loading: boolean } {
  const [catalog, setCatalog] = useState<HytalePrefabPathCatalog>(EMPTY);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setCatalog(EMPTY);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    void getPrefabPathCatalog(projectRoot)
      .then((result) => {
        if (!active) return;
        setCatalog(result);
      })
      .catch((err) => {
        if (!active) return;
        setCatalog({
          paths: [],
          truncated: false,
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectRoot, enabled]);

  return { ...catalog, loading };
}
