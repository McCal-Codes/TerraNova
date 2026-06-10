import type { BridgeDiscovery } from "@/utils/ipc";

/** Turn Hytale instance world ids into short labels for the UI. */
export function formatBridgeWorldLabel(
  world?: string | null,
  worldLabel?: string | null,
): string {
  if (worldLabel?.trim()) return worldLabel.trim();
  if (!world) return "—";
  if (world === "default") return "default";
  const rest = world.startsWith("instance-") ? world.slice("instance-".length) : world;
  if (rest.length > 37) {
    const tail = rest.slice(-36);
    if (/^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(tail)) {
      const slug = rest.slice(0, -37).replace(/-$/, "");
      if (slug) return slug;
    }
  }
  return world;
}

const LOG_LIVE_SOURCES = new Set([
  "server_log_membership",
  "server_log",
]);

export function bridgeLiveStatusHint(
  live?: boolean | null,
  sessionActive?: boolean | null,
): string | null {
  if (live) {
    return "Hytale session active — world from server log.";
  }
  if (sessionActive === false) {
    return "Hytale not running (or log idle) — showing last known world from save/log.";
  }
  return null;
}

export function bridgeWorldSourceHint(source?: string | null): string | null {
  if (!source) return null;
  if (LOG_LIVE_SOURCES.has(source)) {
    return "World from server log membership (player save file can lag).";
  }
  if (source === "player_per_world_position") {
    return "World matched from PerWorldData position in the player save.";
  }
  if (source === "recent_world_activity") {
    return "World inferred from recent instance folder writes.";
  }
  return null;
}

export function bridgePositionSourceHint(source?: string | null): string | null {
  if (!source) return null;
  switch (source) {
    case "per_world":
      return "Position from save PerWorldData (updates when the game autosaves).";
    case "server_log":
      return "Position from server log (join / add-to-world — updates on hop or teleport).";
    case "player_save":
      return "Position from player Transform (matches PlayerData.World).";
    default:
      return null;
  }
}

export function bridgeChunkOnDiskHint(onDisk?: boolean | null): string | null {
  if (onDisk == null) return null;
  return onDisk
    ? "Player chunk column is saved on disk — World preview can load real terrain."
    : "No region file at the player chunk yet — walk that area in Autumn Forest, save, then Connect and reload World preview.";
}

export function formatBridgeDiscoverySummary(
  d: BridgeDiscovery | null,
  host = "127.0.0.1",
  port = 7854,
): string {
  if (!d) return "Bridge: not checked";
  if (!d.portOpen) {
    return `Bridge: offline (${host}:${port})`;
  }
  const mode = d.bridgeVersion?.includes("sidecar") ? "sidecar" : d.bridgeMode ?? "server";
  const worldLabel = formatBridgeWorldLabel(d.playerWorld, d.playerWorldLabel);
  const world = d.playerWorldLive ? `${worldLabel} (live)` : worldLabel;
  const player = d.playerName ?? "—";
  const chunk =
    d.chunkX != null && d.chunkZ != null ? `chunk ${d.chunkX},${d.chunkZ}` : null;
  const block =
    d.playerX != null && d.playerZ != null
      ? `@ ${Math.floor(d.playerX)}, ${Math.floor(d.playerZ)}`
      : null;
  const mod = d.modPackFolder ?? (d.modPackPath ? d.modPackPath.split(/[/\\]/).pop() : null);
  const parts = [`Bridge: ${mode} @${port}`, d.saveName, mod, player, world];
  if (block) parts.push(block);
  else if (chunk) parts.push(chunk);
  return parts.filter(Boolean).join(" · ");
}
