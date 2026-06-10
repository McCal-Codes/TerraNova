import { useEffect, useState } from "react";
import {
  listHytaleAssignmentNames,
  type HytaleAssignmentNameCatalog,
} from "@/utils/hytaleBlockAssets/listHytaleAssignmentNames";

const EMPTY: HytaleAssignmentNameCatalog = {
  names: [],
  pathsByName: {},
  truncated: false,
  error: null,
};

export function useAssignmentNameCatalog(projectRoot: string | null, enabled = true) {
  const [catalog, setCatalog] = useState<HytaleAssignmentNameCatalog>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setCatalog(EMPTY);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void listHytaleAssignmentNames(projectRoot).then((result) => {
      if (cancelled) return;
      setCatalog(result);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [projectRoot, enabled]);

  return { catalog, loading };
}
