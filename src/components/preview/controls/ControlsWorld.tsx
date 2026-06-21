import { useState, useEffect } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { useBridgeStore } from "@/stores/bridgeStore";
import { SliderField } from "@/components/properties/SliderField";
import {
  applyLivePlayerToPreview,
  chunkCoordsFromBlock,
  livePlayerPositionSourceLabel,
} from "@/utils/livePlayerTracking";
import { bridgePositionSourceHint } from "@/utils/bridgeDiscovery";

export function ControlsWorld() {
  const worldCenterX = usePreviewStore((s) => s.worldCenterX);
  const setWorldCenterX = usePreviewStore((s) => s.setWorldCenterX);
  const worldCenterZ = usePreviewStore((s) => s.worldCenterZ);
  const setWorldCenterZ = usePreviewStore((s) => s.setWorldCenterZ);
  const worldRadius = usePreviewStore((s) => s.worldRadius);
  const setWorldRadius = usePreviewStore((s) => s.setWorldRadius);
  const worldYMin = usePreviewStore((s) => s.worldYMin);
  const setWorldYMin = usePreviewStore((s) => s.setWorldYMin);
  const worldYMax = usePreviewStore((s) => s.worldYMax);
  const setWorldYMax = usePreviewStore((s) => s.setWorldYMax);
  const isWorldLoading = usePreviewStore((s) => s.isWorldLoading);
  const worldChunkCount = usePreviewStore((s) => s.worldChunkCount);
  const worldTotalChunks = usePreviewStore((s) => s.worldTotalChunks);
  const worldFollowPlayer = usePreviewStore((s) => s.worldFollowPlayer);
  const setWorldFollowPlayer = usePreviewStore((s) => s.setWorldFollowPlayer);
  const worldForceLoad = usePreviewStore((s) => s.worldForceLoad);
  const setWorldForceLoad = usePreviewStore((s) => s.setWorldForceLoad);
  const worldSurfaceDepth = usePreviewStore((s) => s.worldSurfaceDepth);
  const setWorldSurfaceDepth = usePreviewStore((s) => s.setWorldSurfaceDepth);
  const worldLavaLevel = usePreviewStore((s) => s.worldLavaLevel);
  const setWorldLavaLevel = usePreviewStore((s) => s.setWorldLavaLevel);
  const showVoxelWireframe = usePreviewStore((s) => s.showVoxelWireframe);
  const setShowVoxelWireframe = usePreviewStore((s) => s.setShowVoxelWireframe);
  const showFog3D = usePreviewStore((s) => s.showFog3D);
  const setShowFog3D = usePreviewStore((s) => s.setShowFog3D);
  const showSky3D = usePreviewStore((s) => s.showSky3D);
  const setShowSky3D = usePreviewStore((s) => s.setShowSky3D);
  const showSSAO = usePreviewStore((s) => s.showSSAO);
  const setShowSSAO = usePreviewStore((s) => s.setShowSSAO);
  const showEdgeOutline = usePreviewStore((s) => s.showEdgeOutline);
  const setShowEdgeOutline = usePreviewStore((s) => s.setShowEdgeOutline);

  const bridgeConnected = useBridgeStore((s) => s.connected);
  const bridgeSidecar = useBridgeStore(
    (s) =>
      s.serverStatus?.bridge_mode === "sidecar" ||
      s.serverStatus?.bridge_version?.includes("sidecar") === true,
  );
  const worldDataSource = usePreviewStore((s) => s.worldDataSource);
  const worldBlockColorStats = usePreviewStore((s) => s.worldBlockColorStats);
  const worldLivePlayer = usePreviewStore((s) => s.worldLivePlayer);
  const showWorldPlayerMarker = usePreviewStore((s) => s.showWorldPlayerMarker);
  const setShowWorldPlayerMarker = usePreviewStore((s) => s.setShowWorldPlayerMarker);
  const bridgeDiscovery = useBridgeStore((s) => s.discovery);

  // Local state for Center X/Z — commit to store on blur/Enter
  const [localCenterX, setLocalCenterX] = useState(String(worldCenterX));
  const [localCenterZ, setLocalCenterZ] = useState(String(worldCenterZ));

  useEffect(() => { setLocalCenterX(String(worldCenterX)); }, [worldCenterX]);
  useEffect(() => { setLocalCenterZ(String(worldCenterZ)); }, [worldCenterZ]);

  function commitCenterX() {
    const v = parseInt(localCenterX, 10);
    if (!isNaN(v) && v !== worldCenterX) {
      setWorldFollowPlayer(false);
      setWorldCenterX(v);
    } else {
      setLocalCenterX(String(worldCenterX));
    }
  }
  function commitCenterZ() {
    const v = parseInt(localCenterZ, 10);
    if (!isNaN(v) && v !== worldCenterZ) {
      setWorldFollowPlayer(false);
      setWorldCenterZ(v);
    } else {
      setLocalCenterZ(String(worldCenterZ));
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-tn-border pt-2">
      <span className="text-[10px] text-tn-text-muted font-medium">World Options</span>

      {!bridgeConnected && (
        <p className="text-[10px] text-yellow-400">Connect to bridge to load world data</p>
      )}

      {bridgeConnected && worldBlockColorStats && (
        <p
          className={`text-[10px] leading-snug ${
            worldBlockColorStats.textured === worldBlockColorStats.total
              ? "text-emerald-400"
              : worldBlockColorStats.textured > 0
                ? "text-cyan-400"
                : "text-amber-400"
          }`}
        >
          Block colors: {worldBlockColorStats.textured}/{worldBlockColorStats.total} from synced Hytale assets
          {worldBlockColorStats.textured === 0
            ? " — run Settings → Assets sync for in-game textures"
            : ""}
        </p>
      )}

      {bridgeConnected && worldDataSource && (
        <p
          className={`text-[10px] leading-snug ${
            worldDataSource === "save"
              ? "text-emerald-400"
              : worldDataSource === "mixed"
                ? "text-amber-400"
                : "text-amber-400"
          }`}
        >
          Terrain:{" "}
          {worldDataSource === "save"
            ? "saved chunks from disk"
            : worldDataSource === "mixed"
              ? "mix of saved + synthetic chunks"
              : "synthetic fallback (not on disk yet)"}
        </p>
      )}

      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 flex-1">
          <label className="text-[10px] text-tn-text-muted">Center X</label>
          <input
            type="number"
            value={localCenterX}
            onChange={(e) => setLocalCenterX(e.target.value)}
            onBlur={commitCenterX}
            onKeyDown={(e) => e.key === "Enter" && commitCenterX()}
            className="bg-tn-panel border border-tn-border rounded px-1.5 py-0.5 text-[11px] text-tn-text w-full"
          />
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          <label className="text-[10px] text-tn-text-muted">Center Z</label>
          <input
            type="number"
            value={localCenterZ}
            onChange={(e) => setLocalCenterZ(e.target.value)}
            onBlur={commitCenterZ}
            onKeyDown={(e) => e.key === "Enter" && commitCenterZ()}
            className="bg-tn-panel border border-tn-border rounded px-1.5 py-0.5 text-[11px] text-tn-text w-full"
          />
        </div>
      </div>

      <SliderField label="Chunk Radius" value={worldRadius} min={1} max={5} step={1} onChange={setWorldRadius} />
      <SliderField label="Y Min" value={worldYMin} min={0} max={319} step={1} onChange={setWorldYMin} />
      <SliderField label="Y Max" value={worldYMax} min={1} max={320} step={1} onChange={setWorldYMax} />
      <SliderField label="Surface Depth" value={worldSurfaceDepth} min={4} max={128} step={4} onChange={setWorldSurfaceDepth} />
      <SliderField label="Lava Level" value={worldLavaLevel} min={0} max={200} step={1} onChange={setWorldLavaLevel} />

      {bridgeConnected && worldLivePlayer && (
        <div className="rounded border border-tn-border/80 bg-tn-panel/60 px-2 py-1.5 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-tn-text-muted font-medium">Live player</span>
            <button
              type="button"
              className="text-[10px] text-tn-accent hover:underline shrink-0"
              onClick={() => applyLivePlayerToPreview(worldLivePlayer, { follow: true })}
            >
              Center preview
            </button>
          </div>
          <span className="text-[10px] font-mono text-tn-text">
            {Math.floor(worldLivePlayer.x)}, {Math.floor(worldLivePlayer.y)}, {Math.floor(worldLivePlayer.z)}
            <span className="text-tn-text-muted/80 ml-1">
              (chunk {chunkCoordsFromBlock(worldLivePlayer.x, worldLivePlayer.z).cx},{" "}
              {chunkCoordsFromBlock(worldLivePlayer.x, worldLivePlayer.z).cz})
            </span>
          </span>
          <span
            className="text-[10px] text-tn-text-muted/90"
            title={bridgePositionSourceHint(
              bridgeDiscovery?.playerPositionSource ?? worldLivePlayer.source,
            ) ?? undefined}
          >
            Source: {livePlayerPositionSourceLabel(
              bridgeDiscovery?.playerPositionSource ?? worldLivePlayer.source,
            )}
          </span>
        </div>
      )}

      <label className="flex items-center gap-1.5 text-[11px] text-tn-text-muted cursor-pointer">
        <input type="checkbox" checked={worldFollowPlayer} onChange={(e) => setWorldFollowPlayer(e.target.checked)} className="accent-tn-accent w-3 h-3" />
        Follow player (recenter chunks)
      </label>

      <label className="flex items-center gap-1.5 text-[11px] text-tn-text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={showWorldPlayerMarker}
          onChange={(e) => setShowWorldPlayerMarker(e.target.checked)}
          disabled={!worldLivePlayer}
          className="accent-cyan-400 w-3 h-3 disabled:opacity-40"
        />
        Show player marker in 3D
      </label>

      <div
        title={
          bridgeSidecar
            ? "Sidecar reads saved *.region.bin files only — does not generate terrain."
            : "When enabled, the server will generate chunks that aren't loaded in memory."
        }
      >
        <label className="flex items-center gap-1.5 text-[11px] text-tn-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={worldForceLoad}
            onChange={(e) => setWorldForceLoad(e.target.checked)}
            disabled={bridgeSidecar}
            className="accent-amber-400 w-3 h-3 disabled:opacity-40"
          />
          Generate Chunks
        </label>
        {bridgeSidecar ? (
          <p className="text-[10px] text-tn-text-muted/90 ml-[18px] mt-0.5">
            N/A in sidecar mode — explore in-game so chunks save to disk.
          </p>
        ) : worldForceLoad ? (
          <p className="text-[10px] text-amber-400/80 ml-[18px] mt-0.5">Server will generate unloaded terrain</p>
        ) : null}
      </div>

      {isWorldLoading && (
        <div className="flex items-center gap-1.5 text-[11px] text-tn-text-muted">
          <span className="inline-block w-3 h-3 border-2 border-tn-accent border-t-transparent rounded-full animate-spin" />
          Loading {worldChunkCount}/{worldTotalChunks} chunks
        </div>
      )}

      <div className="border-t border-tn-border pt-2 flex flex-col gap-2">
        <span className="text-[10px] text-tn-text-muted font-medium">Render Options</span>

        <label className="flex items-center gap-1.5 text-[11px] text-tn-text-muted cursor-pointer">
          <input type="checkbox" checked={showVoxelWireframe} onChange={(e) => setShowVoxelWireframe(e.target.checked)} className="accent-tn-accent w-3 h-3" />
          Wireframe
        </label>

        <label className="flex items-center gap-1.5 text-[11px] text-tn-text-muted cursor-pointer">
          <input type="checkbox" checked={showFog3D} onChange={(e) => setShowFog3D(e.target.checked)} className="accent-tn-accent w-3 h-3" />
          Fog
        </label>

        <label className="flex items-center gap-1.5 text-[11px] text-tn-text-muted cursor-pointer">
          <input type="checkbox" checked={showSky3D} onChange={(e) => setShowSky3D(e.target.checked)} className="accent-tn-accent w-3 h-3" />
          Sky
        </label>

        <label className="flex items-center gap-1.5 text-[11px] text-tn-text-muted cursor-pointer">
          <input type="checkbox" checked={showSSAO} onChange={(e) => setShowSSAO(e.target.checked)} className="accent-tn-accent w-3 h-3" />
          SSAO
        </label>

        <label className="flex items-center gap-1.5 text-[11px] text-tn-text-muted cursor-pointer">
          <input type="checkbox" checked={showEdgeOutline} onChange={(e) => setShowEdgeOutline(e.target.checked)} className="accent-tn-accent w-3 h-3" />
          Edge Outline
        </label>
      </div>
    </div>
  );
}
