import { useEffect, useState } from "react";
import {
  listHytaleEnvironmentIds,
  type HytaleEnvironmentIdCatalog,
} from "@/utils/packWizard/listHytaleEnvironmentIds";

const EMPTY: HytaleEnvironmentIdCatalog = {
  ids: [],
  source: "fallback",
  error: null,
};

export function useHytaleEnvironmentIds(enabled = true): HytaleEnvironmentIdCatalog & { loading: boolean } {
  const [catalog, setCatalog] = useState<HytaleEnvironmentIdCatalog>(EMPTY);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setCatalog(EMPTY);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    void listHytaleEnvironmentIds()
      .then((result) => {
        if (!active) return;
        setCatalog(result);
      })
      .catch((err) => {
        if (!active) return;
        setCatalog({
          ids: [],
          source: "fallback",
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  return { ...catalog, loading };
}
