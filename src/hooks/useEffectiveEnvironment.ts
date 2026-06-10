import { useEffect, useState } from "react";
import { listDirectory, readAssetFile } from "@/utils/ipc";
import {
  getAssetIndex,
  loadEnvironmentWithParents,
  type JsonRecord,
  type LoadedEnvironment,
} from "@/utils/atmosphere";

const INITIAL: LoadedEnvironment & { loading: boolean } = {
  mergedEnvironment: null,
  requestedPath: null,
  parentChain: [],
  warnings: [],
  loading: false,
};

export function useEffectiveEnvironment(
  environmentDoc: JsonRecord | null,
  environmentName: string | null,
  serverRoot: string | null,
  lookupRevision: number,
): LoadedEnvironment & { loading: boolean } {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    if (!environmentDoc || !environmentName || !serverRoot) {
      setState({ ...INITIAL, mergedEnvironment: environmentDoc });
      return;
    }

    let active = true;
    setState((prev) => ({ ...prev, loading: true }));

    void (async () => {
      try {
        const deps = { listDirectoryFn: listDirectory, readAssetFileFn: readAssetFile };
        const assetIndex = await getAssetIndex(serverRoot, deps);
        const loaded = await loadEnvironmentWithParents(environmentName, assetIndex, deps);
        if (!active) return;
        setState({
          ...loaded,
          mergedEnvironment: loaded.mergedEnvironment ?? environmentDoc,
          loading: false,
        });
      } catch {
        if (!active) return;
        setState({ ...INITIAL, mergedEnvironment: environmentDoc, loading: false });
      }
    })();

    return () => {
      active = false;
    };
  }, [environmentDoc, environmentName, lookupRevision, serverRoot]);

  return state;
}
