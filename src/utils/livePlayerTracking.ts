import type { BridgeDiscovery, PlayerInfo } from "@/utils/ipc";
import { usePreviewStore } from "@/stores/previewStore";

export type LivePlayerCoords = {
  x: number;
  y: number;
  z: number;
  source: string;
  worldLabel?: string;
};

export function livePlayerFromDiscovery(d: BridgeDiscovery): LivePlayerCoords | null {
  if (d.playerX == null || d.playerZ == null) return null;
  return {
    x: d.playerX,
    y: d.playerY ?? 64,
    z: d.playerZ,
    source: d.playerPositionSource ?? "unknown",
    worldLabel: d.playerWorldLabel ?? undefined,
  };
}

export function livePlayerFromInfo(info: PlayerInfo): LivePlayerCoords | null {
  if (info.x == null || info.z == null) return null;
  return {
    x: info.x,
    y: info.y ?? 64,
    z: info.z,
    source: info.positionSource ?? "unknown",
    worldLabel: info.worldLabel ?? undefined,
  };
}

export function chunkCoordsFromBlock(x: number, z: number): { cx: number; cz: number } {
  return { cx: Math.floor(x / 32), cz: Math.floor(z / 32) };
}

/** Push live player into preview store and optionally recenter chunk grid. */
export function applyLivePlayerToPreview(
  coords: LivePlayerCoords,
  options?: { follow?: boolean },
): void {
  const preview = usePreviewStore.getState();
  preview.setWorldLivePlayer(coords);

  const follow = options?.follow ?? preview.worldFollowPlayer;
  if (!follow) return;

  const { cx, cz } = chunkCoordsFromBlock(coords.x, coords.z);
  if (preview.worldCenterX !== cx || preview.worldCenterZ !== cz) {
    preview.setWorldCenterX(cx);
    preview.setWorldCenterZ(cz);
  }
}

export function livePlayerPositionSourceLabel(source?: string | null): string {
  switch (source) {
    case "per_world":
      return "save (PerWorldData)";
    case "server_log":
      return "server log";
    case "player_save":
      return "player save";
    default:
      return "unknown";
  }
}
