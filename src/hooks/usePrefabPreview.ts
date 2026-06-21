import { useEffect, useRef, useState } from "react";
import type { PrefabPreviewMeshData } from "@/utils/hytaleBlockAssets/buildPrefabPreviewMesh";
import { PREFAB_PREVIEW_BLOCK_CAP } from "@/utils/hytaleBlockAssets/buildPrefabPreviewMesh";
import { extractPrefabPathFromFields } from "@/utils/hytaleBlockAssets/extractPrefabPath";
import { loadTexturedPrefabPreview } from "@/utils/hytaleBlockAssets/loadTexturedPrefabPreview";
import { isTauriRuntime } from "@/utils/platform";

export interface PrefabPreviewState {
  loading: boolean;
  error: string | null;
  mesh: PrefabPreviewMeshData | null;
  resolvedPath: string | null;
  entityCount: number;
  relativePath: string | null;
  texturedBlockTypes: number;
  totalBlockTypes: number;
}

const EMPTY: PrefabPreviewState = {
  loading: false,
  error: null,
  mesh: null,
  resolvedPath: null,
  entityCount: 0,
  relativePath: null,
  texturedBlockTypes: 0,
  totalBlockTypes: 0,
};

export interface UsePrefabPreviewOptions {
  debounceMs?: number;
  renderCap?: number;
}

export function usePrefabPreview(
  fields: Record<string, unknown>,
  projectRoot: string | null,
  debounceMsOrOptions: number | UsePrefabPreviewOptions = 350,
): PrefabPreviewState {
  const options =
    typeof debounceMsOrOptions === "number"
      ? { debounceMs: debounceMsOrOptions, renderCap: PREFAB_PREVIEW_BLOCK_CAP }
      : {
          debounceMs: debounceMsOrOptions.debounceMs ?? 350,
          renderCap: debounceMsOrOptions.renderCap ?? PREFAB_PREVIEW_BLOCK_CAP,
        };

  const [state, setState] = useState<PrefabPreviewState>(EMPTY);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);

  const relativePath = extractPrefabPathFromFields(fields);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!relativePath) {
      setState({ ...EMPTY, relativePath: null });
      return;
    }

    if (!isTauriRuntime()) {
      setState({
        ...EMPTY,
        relativePath,
        error: "Prefab preview requires the TerraNova desktop app and synced Hytale assets.",
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      relativePath,
    }));

    timerRef.current = setTimeout(() => {
      const requestId = ++requestRef.current;

      void (async () => {
        try {
          const result = await loadTexturedPrefabPreview(relativePath, {
            projectRoot,
            renderCap: options.renderCap,
          });

          if (requestId !== requestRef.current) return;

          setState({
            loading: false,
            error: null,
            mesh: result.mesh,
            resolvedPath: result.resolvedPath,
            entityCount: result.entityCount,
            relativePath,
            texturedBlockTypes: result.texturedBlockTypes,
            totalBlockTypes: result.totalBlockTypes,
          });
        } catch (err) {
          if (requestId !== requestRef.current) return;
          setState({
            loading: false,
            error: err instanceof Error ? err.message : String(err),
            mesh: null,
            resolvedPath: null,
            entityCount: 0,
            relativePath,
            texturedBlockTypes: 0,
            totalBlockTypes: 0,
          });
        }
      })();
    }, options.debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [relativePath, projectRoot, options.debounceMs, options.renderCap]);

  return state;
}
