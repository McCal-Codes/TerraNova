import { useEffect, useRef, useState } from "react";
import { buildPrefabPreviewMesh, type PrefabPreviewMeshData } from "@/utils/hytaleBlockAssets/buildPrefabPreviewMesh";
import { extractPrefabPathFromFields } from "@/utils/hytaleBlockAssets/extractPrefabPath";
import { readHytalePrefab, resolveHytaleBlockModels } from "@/utils/hytaleBlockAssets";
import { resolvePrefabBlockColors } from "@/utils/hytaleBlockAssets/sampleBlockTextureColors";
import { isTauriRuntime } from "@/utils/platform";

export interface PrefabPreviewState {
  loading: boolean;
  error: string | null;
  mesh: PrefabPreviewMeshData | null;
  resolvedPath: string | null;
  entityCount: number;
  relativePath: string | null;
}

const EMPTY: PrefabPreviewState = {
  loading: false,
  error: null,
  mesh: null,
  resolvedPath: null,
  entityCount: 0,
  relativePath: null,
};

export function usePrefabPreview(
  fields: Record<string, unknown>,
  projectRoot: string | null,
  debounceMs = 350,
): PrefabPreviewState {
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
          const { path, prefab } = await readHytalePrefab(relativePath, projectRoot);
          const blockNames = [...new Set(prefab.blocks.map((b) => b.name))];
          const models = await resolveHytaleBlockModels(blockNames);
          const blockColors = await resolvePrefabBlockColors(models, { blockNames });
          const mesh = buildPrefabPreviewMesh(prefab, models, { blockColors });

          if (requestId !== requestRef.current) return;

          setState({
            loading: false,
            error: null,
            mesh,
            resolvedPath: path,
            entityCount: Array.isArray(prefab.entities) ? prefab.entities.length : 0,
            relativePath,
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
          });
        }
      })();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [relativePath, projectRoot, debounceMs]);

  return state;
}
