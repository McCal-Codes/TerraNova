import { useCallback, useEffect, useState } from "react";
import { inferServerRoot } from "@/utils/pathUtils";
import { scanWeatherAssetIndex, type WeatherAssetIndexResult } from "@/utils/atmosphere";

export type WeatherAssetLookupStatus = "idle" | "loading" | "ready" | "error";

export interface WeatherAssetIndexState {
  status: WeatherAssetLookupStatus;
  options: Array<{ id: string; path: string }>;
  pathIndex: Record<string, string>;
  error: string | null;
  projectWeathersFound: boolean;
  bundledCount: number;
}

const INITIAL_STATE: WeatherAssetIndexState = {
  status: "idle",
  options: [],
  pathIndex: {},
  error: null,
  projectWeathersFound: false,
  bundledCount: 0,
};

function buildLookupMessage(result: WeatherAssetIndexResult, serverRoot: string | null): string | null {
  if (!serverRoot) {
    return result.bundledCount > 0
      ? `Server/Weathers not found - showing ${result.bundledCount} file(s) from the cached Hytale assets.`
      : "Could not infer the Server root for weather lookup.";
  }
  if (!result.projectWeathersFound) {
    return result.bundledCount > 0
      ? `Server/Weathers directory not found. Showing ${result.bundledCount} file(s) from the cached Hytale assets. Create the folder or click "Create Default Weather".`
      : "Server/Weathers directory not found. Create the folder or open a file inside the Server directory.";
  }
  return null;
}

export function useWeatherAssetIndex(
  currentFile: string | null,
  projectPath: string | null,
  lookupRevision = 0,
): WeatherAssetIndexState & { refreshLookup: () => void } {
  const [state, setState] = useState<WeatherAssetIndexState>(INITIAL_STATE);
  const [revision, setRevision] = useState(lookupRevision);

  useEffect(() => {
    setRevision(lookupRevision);
  }, [lookupRevision]);

  const refreshLookup = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const serverRoot = inferServerRoot(currentFile, projectPath);

    setState((prev) => ({ ...prev, status: "loading", error: null }));

    void scanWeatherAssetIndex(serverRoot).then((result) => {
      if (!active) return;
      const error = buildLookupMessage(result, serverRoot);
      setState({
        status: error ? "error" : "ready",
        options: result.options,
        pathIndex: result.pathIndex,
        error,
        projectWeathersFound: result.projectWeathersFound,
        bundledCount: result.bundledCount,
      });
    }).catch((error) => {
      if (!active) return;
      setState({
        ...INITIAL_STATE,
        status: "error",
        error: String(error),
      });
    });

    return () => {
      active = false;
    };
  }, [currentFile, projectPath, revision]);

  return { ...state, refreshLookup };
}
