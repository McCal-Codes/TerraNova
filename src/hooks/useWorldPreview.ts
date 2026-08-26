import { useEffect, useRef } from "react";
import { useAccountStore, preferredPlayerUuid } from "@/stores/accountStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useBridgeStore } from "@/stores/bridgeStore";
import {
  bridgeFetchPalette,
  bridgeFetchChunk,
  bridgePlayerInfo,
  type ChunkDataResponse,
} from "@/utils/ipc";
import { buildWorldMeshes } from "@/utils/worldMeshBuilder";
import {
  detectWaterLevel,
  resolveWorldPaletteAssets,
} from "@/utils/worldPreviewAssets";
import {
  applyLivePlayerToPreview,
  livePlayerFromInfo,
} from "@/utils/livePlayerTracking";
import { useDevMetricsStore } from "@/stores/devMetricsStore";

const FOLLOW_POLL_MS = 3000;
const CHUNK_FETCH_TIMEOUT_MS = 10_000; // Per-chunk fetch timeout (normal)
const CHUNK_FORCE_LOAD_TIMEOUT_MS = 25_000; // Per-chunk fetch timeout (force-load)

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Chunk fetch timed out")), ms),
    ),
  ]);
}

/**
 * World preview hook — fetches real chunk data from TerraNovaBridge
 * and builds meshes for the VoxelPreview3D renderer.
 */
export function useWorldPreview() {
  const mode = usePreviewStore((s) => s.mode);
  const viewMode = usePreviewStore((s) => s.viewMode);
  const worldCenterX = usePreviewStore((s) => s.worldCenterX);
  const worldCenterZ = usePreviewStore((s) => s.worldCenterZ);
  const worldRadius = usePreviewStore((s) => s.worldRadius);
  const worldYMin = usePreviewStore((s) => s.worldYMin);
  const worldYMax = usePreviewStore((s) => s.worldYMax);
  const worldFollowPlayer = usePreviewStore((s) => s.worldFollowPlayer);
  const worldSurfaceDepth = usePreviewStore((s) => s.worldSurfaceDepth);
  const worldLavaLevel = usePreviewStore((s) => s.worldLavaLevel);
  const worldForceLoad = usePreviewStore((s) => s.worldForceLoad);

  const connected = useBridgeStore((s) => s.connected);
  const singleplayer = useBridgeStore((s) => s.singleplayer);
  const blockPalette = useBridgeStore((s) => s.blockPalette);

  const evalIdRef = useRef(0);
  const followTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Scene transform from last mesh build — used for instant lava repositioning
  const sceneTransformRef = useRef<{ yMin: number; scale: number; terrainSize: number } | null>(null);
  // Cache key for the last successful fetch — skip re-fetch when returning to World mode
  const lastFetchKeyRef = useRef<string | null>(null);

  // Fetch palette once when bridge connects
  useEffect(() => {
    if (!connected) {
      useBridgeStore.getState().setBlockPalette(null);
      lastFetchKeyRef.current = null; // invalidate cache on disconnect
      return;
    }

    bridgeFetchPalette()
      .then((res) => {
        useBridgeStore.getState().setBlockPalette(res.palette);
        // Clear any previous palette error
        if (usePreviewStore.getState().mode === "world") {
          usePreviewStore.getState().setWorldError(null);
        }
      })
      .catch((err) => {
        usePreviewStore.getState().setWorldError(
          `Failed to fetch block palette — is TerraNovaBridge v0.2.0+ deployed? (${err})`,
        );
      });
  }, [connected]);

  // Follow player position
  useEffect(() => {
    if (!connected || !worldFollowPlayer || mode !== "world") {
      if (followTimerRef.current) {
        clearInterval(followTimerRef.current);
        followTimerRef.current = null;
      }
      return;
    }

    async function pollPlayer() {
      try {
        const info = await bridgePlayerInfo(preferredPlayerUuid(useAccountStore.getState()));
        const live = livePlayerFromInfo(info);
        if (live) applyLivePlayerToPreview(live, { follow: true });
      } catch {
        // Player not available — ignore
      }
    }

    pollPlayer(); // immediate first poll
    followTimerRef.current = setInterval(pollPlayer, FOLLOW_POLL_MS);

    return () => {
      if (followTimerRef.current) {
        clearInterval(followTimerRef.current);
        followTimerRef.current = null;
      }
    };
  }, [connected, worldFollowPlayer, mode]);

  // Auto-center on player when entering World mode
  useEffect(() => {
    if (mode !== "world" || !connected) return;

    let cancelled = false;

    bridgePlayerInfo(preferredPlayerUuid(useAccountStore.getState()))
      .then((info) => {
        if (cancelled) return;
        const live = livePlayerFromInfo(info);
        if (!live) return;
        applyLivePlayerToPreview(live, { follow: false });
        const store = usePreviewStore.getState();
        if (store.worldCenterX === 0 && store.worldCenterZ === 0) {
          applyLivePlayerToPreview(live, { follow: true });
        }
      })
      .catch(() => {
        // Player info not available — keep current center
      });

    return () => {
      cancelled = true;
    };
  }, [mode, connected]);

  // Main chunk loading effect — debounced to prevent flooding on rapid param changes
  useEffect(() => {
    if (mode !== "world" || viewMode === "graph" || !connected) return;

    if (!blockPalette) {
      usePreviewStore.getState().setWorldLoading(true);
      return;
    }

    const radius = Math.max(0, Math.min(worldRadius, 5));
    const side = 2 * radius + 1;
    const totalChunks = side * side;

    // Cache key — skip re-fetch if params haven't changed (e.g. switching tabs and back)
    // Include palette size to invalidate when reconnecting to a different world
    const paletteKey = blockPalette ? Object.keys(blockPalette).length : 0;
    const fetchKey = `${worldCenterX},${worldCenterZ},${radius},${worldYMin},${worldYMax},${worldSurfaceDepth},${paletteKey},${worldForceLoad}`;
    if (fetchKey === lastFetchKeyRef.current && usePreviewStore.getState().voxelMeshData) {
      usePreviewStore.getState().setWorldLoading(false);
      return;
    }

    let cancelled = false;

    // Debounce: wait 300ms before starting fetches to absorb rapid parameter changes
    const debounceTimer = setTimeout(() => {
      if (cancelled) return;
      startChunkLoading();
    }, 300);

    function startChunkLoading() {
    const evalId = ++evalIdRef.current;
    const store = usePreviewStore.getState();
    const pipelineStart = performance.now();

    store.setWorldLoading(true);
    store.setWorldError(null);
    store.setWorldDataSource(null);
    store.setWorldBlockColorStats(null);
    store.setWorldProgress(0, totalChunks);

    async function loadChunks() {
      // Build list of chunk coordinates to fetch
      const coords: { cx: number; cz: number }[] = [];
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          coords.push({ cx: worldCenterX + dx, cz: worldCenterZ + dz });
        }
      }

      // In singleplayer, client and server share a JVM — limit concurrency to avoid OOM.
      // On dedicated servers, use full batch sizes for throughput.
      const BATCH_SIZE = singleplayer ? 2 : (worldForceLoad ? 4 : 8);
      const timeoutMs = worldForceLoad ? CHUNK_FORCE_LOAD_TIMEOUT_MS : CHUNK_FETCH_TIMEOUT_MS;
      const loadedChunks: ChunkDataResponse[] = [];
      const chunkErrors: string[] = [];
      let loaded = 0;

      for (let i = 0; i < coords.length; i += BATCH_SIZE) {
        if (cancelled || evalId !== evalIdRef.current) return;

        const batch = coords.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(({ cx, cz }) =>
            withTimeout(
              bridgeFetchChunk(cx, cz, worldYMin, worldYMax, worldForceLoad),
              timeoutMs,
            ),
          ),
        );

        for (const r of results) {
          if (r.status === "fulfilled") {
            loadedChunks.push(r.value);
          } else if (chunkErrors.length < 3) {
            const reason = String(r.reason);
            if (!chunkErrors.includes(reason)) chunkErrors.push(reason);
          }
          loaded++;
        }

        if (evalId === evalIdRef.current && !cancelled) {
          usePreviewStore.getState().setWorldProgress(loaded, totalChunks);
        }

        // In singleplayer, pause between batches to let the JVM GC reclaim
        // chunk serialization buffers before the next batch allocates more.
        if (singleplayer && i + BATCH_SIZE < coords.length) {
          await new Promise((r) => setTimeout(r, 200));
          if (cancelled || evalId !== evalIdRef.current) return;
        }

        // Fail-fast: if every chunk in the first batch failed, abort early
        // instead of waiting for all remaining chunks to time out too
        if (i === 0 && loadedChunks.length === 0 && chunkErrors.length > 0) {
          break;
        }
      }

      if (cancelled || evalId !== evalIdRef.current) return;

      if (loadedChunks.length > 0) {
        let saveCount = 0;
        let syntheticCount = 0;
        for (const c of loadedChunks) {
          if (c.dataSource === "synthetic") syntheticCount++;
          else saveCount++;
        }
        const dataSource =
          saveCount === 0 ? "synthetic" : syntheticCount === 0 ? "save" : "mixed";
        usePreviewStore.getState().setWorldDataSource(dataSource);
        if (dataSource === "synthetic") {
          usePreviewStore.getState().setWorldError(
            `No saved chunks on disk around (${worldCenterX}, ${worldCenterZ}). Sidecar shows synthetic terrain — walk the area in-game, then reload preview.`,
          );
        } else {
          usePreviewStore.getState().setWorldError(null);
        }

        // Yield two frames so React can paint "all chunks loaded" before heavy mesh build
        usePreviewStore.getState().setWorldProgress(totalChunks, totalChunks);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (evalId !== evalIdRef.current) return;

        // Sidecar grows the palette as save chunks are decoded; refresh before meshing.
        let paletteForMesh = blockPalette!;
        try {
          const fresh = await bridgeFetchPalette();
          paletteForMesh = fresh.palette;
          useBridgeStore.getState().setBlockPalette(fresh.palette);
        } catch {
          // keep palette from connect
        }

        let blockColors: Record<string, [number, number, number]> = {};
        try {
          const assets = await resolveWorldPaletteAssets(paletteForMesh);
          blockColors = assets.blockColors;
          usePreviewStore.getState().setWorldBlockColorStats({
            textured: assets.texturedCount,
            total: assets.totalBlockTypes,
          });
        } catch {
          usePreviewStore.getState().setWorldBlockColorStats(null);
        }

        const meshFullColumns =
          worldYMax - worldYMin > 64 || worldSurfaceDepth >= 32;

        const { meshes, sceneYMin, sceneScale, terrainSize, worldMidX, worldMidZ } =
          buildWorldMeshes(
          loadedChunks,
          paletteForMesh,
          worldCenterX,
          worldCenterZ,
          worldSurfaceDepth,
          { blockColors, meshFullColumns },
        );
        if (cancelled || evalId !== evalIdRef.current) return;
        sceneTransformRef.current = { yMin: sceneYMin, scale: sceneScale, terrainSize };
        usePreviewStore.getState().setWorldSceneLayout({
          sceneYMin,
          sceneScale,
          worldMidX,
          worldMidZ,
        });
        usePreviewStore.getState().setVoxelMeshData(meshes);

        // Fluid overlay: lava slider wins; otherwise auto-detect water from chunk data.
        const ps = usePreviewStore.getState();
        const currentLavaLevel = ps.worldLavaLevel;
        if (currentLavaLevel > 0) {
          const sceneY = (currentLavaLevel - sceneYMin) * sceneScale - 25;
          ps.setFluidPlaneConfig({ type: "lava", yPosition: sceneY, size: terrainSize });
          ps.setShowWaterPlane(true);
        } else {
          const waterY = detectWaterLevel(loadedChunks, paletteForMesh);
          if (waterY != null) {
            const sceneY = (waterY - sceneYMin) * sceneScale - 25;
            ps.setFluidPlaneConfig({ type: "water", yPosition: sceneY, size: terrainSize });
            ps.setShowWaterPlane(true);
          } else {
            ps.setFluidPlaneConfig(null);
            ps.setShowWaterPlane(false);
          }
        }

        // Mark this fetch as cached
        lastFetchKeyRef.current = fetchKey;

        useDevMetricsStore.getState().reportEval({
          kind: "world",
          durationMs: performance.now() - pipelineStart,
          detail: `${loadedChunks.length}/${totalChunks} chunks · ${dataSource}`,
          at: Date.now(),
        });
      } else {
        usePreviewStore.getState().setWorldDataSource(null);
        const hint = worldForceLoad
          ? "Sidecar reads saved region files only — Generate Chunks has no effect until an in-server plugin ships."
          : "Move in-game so Hytale writes chunks to the save, or center preview on a saved area.";
        const errorDetail = chunkErrors.length > 0
          ? `\n\nServer: ${chunkErrors[0]}`
          : "";
        usePreviewStore.getState().setWorldError(
          `No loaded chunks found — tried ${totalChunks} chunks around (${worldCenterX}, ${worldCenterZ}). ${hint}${errorDetail}`,
        );
        usePreviewStore.getState().setVoxelMeshData(null);
        lastFetchKeyRef.current = null;
      }

      usePreviewStore.getState().setWorldLoading(false);
    }

    loadChunks().catch((err) => {
      if (evalId === evalIdRef.current) {
        usePreviewStore.getState().setWorldError(`World loading failed: ${err}`);
        usePreviewStore.getState().setWorldLoading(false);
      }
    });
    } // end startChunkLoading

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [mode, viewMode, connected, singleplayer, blockPalette, worldCenterX, worldCenterZ, worldRadius, worldYMin, worldYMax, worldSurfaceDepth, worldForceLoad]);

  // Instant fluid plane repositioning — no re-fetch, no re-mesh
  useEffect(() => {
    const t = sceneTransformRef.current;
    if (mode !== "world" || !t) return;

    if (worldLavaLevel > 0) {
      const sceneY = (worldLavaLevel - t.yMin) * t.scale - 25; // 25 = sceneSize/2
      usePreviewStore.getState().setFluidPlaneConfig({
        type: "lava",
        yPosition: sceneY,
        size: t.terrainSize,
      });
      usePreviewStore.getState().setShowWaterPlane(true);
    }
    // When lava is off, keep water plane from last mesh build (auto-detected).
  }, [mode, worldLavaLevel]);
}
