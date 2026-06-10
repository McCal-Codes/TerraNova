import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useBridgeStore } from "@/stores/bridgeStore";
import { useBridge } from "@/hooks/useBridge";
import { useTauriIO } from "@/hooks/useTauriIO";
import { useProjectStore } from "@/stores/projectStore";
import { bridgeDiscover, readAssetFile, type SaveModPackEntry } from "@/utils/ipc";
import {
  bridgeLiveStatusHint,
  bridgeWorldSourceHint,
  bridgeChunkOnDiskHint,
  bridgePositionSourceHint,
  formatBridgeWorldLabel,
} from "@/utils/bridgeDiscovery";
import { tryBridgeAutoConnect, isBridgeAutoConnectEnabled } from "@/utils/bridgeAutoConnect";
import {
  applyLivePlayerToPreview,
  livePlayerFromDiscovery,
  livePlayerPositionSourceLabel,
} from "@/utils/livePlayerTracking";
import { resolveBridgeDiscoveryHints } from "@/utils/resolveBridgeSaveContext";
import { usePreviewStore } from "@/stores/previewStore";
import {
  deriveTerraNovaModFolderName,
  resolveSaveModPackRootByFolder,
  resolveSaveModsRoot,
  TERRANOVA_BRIDGE_MOD_FOLDER,
} from "@/utils/hytaleModPaths";
import { linkModPackToBridge, openSaveModPackByPath } from "@/utils/saveModWorkflow";
import { BridgeDebugPanel } from "@/components/bridge/BridgeDebugPanel";

function normalizeModPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function isSelectedModPack(selected: string, packPath: string): boolean {
  return Boolean(selected) && normalizeModPath(selected) === normalizeModPath(packPath);
}

type DiscoveryRefreshConfig = {
  host: string;
  port: string;
  authToken: string;
  serverModPath: string;
};

export function BridgeDialog() {
  const isOpen = useBridgeStore((s) => s.dialogOpen);
  const connected = useBridgeStore((s) => s.connected);
  const connecting = useBridgeStore((s) => s.connecting);
  const serverStatus = useBridgeStore((s) => s.serverStatus);
  const lastError = useBridgeStore((s) => s.lastError);
  const lastNotice = useBridgeStore((s) => s.lastNotice);
  const storeHost = useBridgeStore((s) => s.host);
  const storePort = useBridgeStore((s) => s.port);
  const storeAuthToken = useBridgeStore((s) => s.authToken);
  const storeServerModPath = useBridgeStore((s) => s.serverModPath);
  const discovery = useBridgeStore((s) => s.discovery);
  const discoveryProbing = useBridgeStore((s) => s.discoveryProbing);
  const setDialogOpen = useBridgeStore((s) => s.setDialogOpen);

  const [host, setHost] = useState(storeHost);
  const [port, setPort] = useState(String(storePort));
  const [authToken, setAuthToken] = useState(storeAuthToken);
  const [serverModPath, setServerModPath] = useState(storeServerModPath);
  const [showToken, setShowToken] = useState(false);
  const [testModFolder, setTestModFolder] = useState<string | null>(null);

  // Regen chunks fields
  const [regenX, setRegenX] = useState("0");
  const [regenZ, setRegenZ] = useState("0");
  const [regenRadius, setRegenRadius] = useState("3");
  const [viewportRadius, setViewportRadius] = useState("64");
  const [viewportCopied, setViewportCopied] = useState(false);
  const [uiMode, setUiMode] = useState<"simple" | "advanced">("simple");

  // Teleport fields
  const [tpPlayer, setTpPlayer] = useState("");
  const [tpX, setTpX] = useState("0");
  const [tpY, setTpY] = useState("64");
  const [tpZ, setTpZ] = useState("0");

  // Player info
  const [playerInfo, setPlayerInfo] = useState<{
    name: string;
    x?: number;
    y?: number;
    z?: number;
    world?: string;
  } | null>(null);

  const { openFile } = useTauriIO();
  const {
    connect,
    disconnect,
    reloadWorldgen,
    regenerateChunks,
    teleport,
    getPlayerInfo,
    syncAndReload,
  } = useBridge();

  const refreshDiscovery = useCallback(async (config: DiscoveryRefreshConfig) => {
    const portNum = parseInt(config.port, 10) || 7854;
    const store = useBridgeStore.getState();
    const hints = resolveBridgeDiscoveryHints(
      config.serverModPath,
      useProjectStore.getState().projectPath,
    );
    store.setDiscovery(store.discovery, true);
    try {
      const modPackPath =
        hints.modPackPath ?? (config.serverModPath ? config.serverModPath : undefined);
      const result = await bridgeDiscover({
        saveName: hints.saveName,
        saveRoot: hints.saveRoot,
        modPackPath,
        host: config.host,
        port: portNum,
      });
      store.setDiscovery(result, false);
      const suggested =
        result.suggestedModPackPath ?? result.bridgeModPackPath;
      if (!config.serverModPath && suggested) {
        setServerModPath(suggested);
        useBridgeStore.getState().setServerModPath(suggested);
      }
      if (result.authTokenFromConfig && !config.authToken.trim()) {
        setAuthToken(result.authTokenFromConfig);
        useBridgeStore
          .getState()
          .setConnectionConfig(config.host, portNum, result.authTokenFromConfig);
      }
      if (result.playerName) {
        setPlayerInfo({
          name: result.playerName,
          x: result.playerX,
          y: result.playerY,
          z: result.playerZ,
          world: result.playerWorld,
        });
        setTpPlayer(result.playerName);
        if (result.playerX != null) setTpX(String(result.playerX));
        if (result.playerY != null) setTpY(String(result.playerY));
        if (result.playerZ != null) setTpZ(String(result.playerZ));
      }
      if (result.chunkX != null && result.chunkZ != null) {
        setRegenX(String(result.chunkX));
        setRegenZ(String(result.chunkZ));
      }
      const live = livePlayerFromDiscovery(result);
      if (live) {
        applyLivePlayerToPreview(live, {
          follow: usePreviewStore.getState().worldFollowPlayer,
        });
      }
      if (!useBridgeStore.getState().connected) {
        await tryBridgeAutoConnect(result);
      }
    } catch (err) {
      const hints = resolveBridgeDiscoveryHints(
        config.serverModPath,
        useProjectStore.getState().projectPath,
      );
      useBridgeStore.getState().setDiscovery(
        { portOpen: false, saveName: hints.saveName, error: String(err) },
        false,
      );
    }
  }, []);

  // Sync local state with store when dialog opens
  useEffect(() => {
    if (isOpen) {
      const storeState = useBridgeStore.getState();
      const nextConfig = {
        host: storeState.host,
        port: String(storeState.port),
        authToken: storeState.authToken,
        serverModPath: storeState.serverModPath,
      };
      setHost(nextConfig.host);
      setPort(nextConfig.port);
      setAuthToken(nextConfig.authToken);
      setServerModPath(nextConfig.serverModPath);
      setPlayerInfo(null);
      void refreshDiscovery(nextConfig);

      let cancelled = false;
      void (async () => {
        const projectPath = useProjectStore.getState().projectPath;
        if (!projectPath) {
          setTestModFolder(null);
          return;
        }
        let manifestName: string | undefined;
        let searchDir = projectPath;
        for (let i = 0; i < 4; i++) {
          try {
            const raw = await readAssetFile(`${searchDir}/manifest.json`);
            if (raw && typeof raw === "object" && typeof (raw as { name?: string }).name === "string") {
              manifestName = (raw as { name: string }).name;
              break;
            }
          } catch {
            // try parent
          }
          const parent = searchDir.replace(/[/\\][^/\\]+$/, "");
          if (parent === searchDir) break;
          searchDir = parent;
        }
        if (cancelled) return;
        setTestModFolder(
          deriveTerraNovaModFolderName(manifestName, projectPath.split(/[/\\]/).pop()),
        );
      })();

      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, refreshDiscovery]);

  if (!isOpen) return null;

  function onClose() {
    setDialogOpen(false);
  }

  async function handleConnect() {
    // Save config to store before connecting
    const portNum = parseInt(port, 10) || 7854;
    useBridgeStore.getState().setConnectionConfig(host, portNum, authToken);
    if (serverModPath) {
      useBridgeStore.getState().setServerModPath(serverModPath);
    }
    await connect();
    const d = useBridgeStore.getState().discovery;
    if (d?.chunkX != null && d.chunkZ != null) {
      const preview = usePreviewStore.getState();
      preview.setWorldCenterX(d.chunkX);
      preview.setWorldCenterZ(d.chunkZ);
      preview.setWorldFollowPlayer(true);
    }
    const info = await getPlayerInfo();
    if (info) {
      setPlayerInfo(info);
      setTpPlayer(info.name);
      if (info.x != null) setTpX(String(info.x));
      if (info.y != null) setTpY(String(info.y));
      if (info.z != null) setTpZ(String(info.z));
    }
  }

  async function handleDisconnect() {
    await disconnect();
    setPlayerInfo(null);
  }

  async function handleReloadWorldgen() {
    await reloadWorldgen();
  }

  async function handleRegenChunks() {
    await regenerateChunks(
      parseInt(regenX, 10) || 0,
      parseInt(regenZ, 10) || 0,
      parseInt(regenRadius, 10) || 3,
    );
  }

  async function handleTeleport() {
    if (!tpPlayer.trim()) return;
    await teleport(
      tpPlayer.trim(),
      parseFloat(tpX) || 0,
      parseFloat(tpY) || 64,
      parseFloat(tpZ) || 0,
    );
  }

  async function handleGetPlayerInfo() {
    const info = await getPlayerInfo();
    if (info) setPlayerInfo(info);
  }

  function applyCoordsToPreview() {
    const x = parseFloat(tpX);
    const z = parseFloat(tpZ);
    if (Number.isNaN(x) || Number.isNaN(z)) return;
    const preview = usePreviewStore.getState();
    preview.setWorldCenterX(Math.floor(x / 32));
    preview.setWorldCenterZ(Math.floor(z / 32));
    preview.setWorldFollowPlayer(false);
    setRegenX(String(Math.floor(x / 32)));
    setRegenZ(String(Math.floor(z / 32)));
  }

  async function handleSyncAndReload() {
    if (serverModPath) {
      useBridgeStore.getState().setServerModPath(serverModPath);
    }
    await syncAndReload();
  }

  async function handleBrowseModPath() {
    const defaultPath = await resolveSaveModsRoot().catch(() => undefined);
    const selected = await open({
      directory: true,
      title: "Select mod pack root (folder containing Server/)",
      defaultPath,
    });
    if (selected) {
      const path = typeof selected === "string" ? selected : selected;
      setServerModPath(path);
      useBridgeStore.getState().setServerModPath(path);
    }
  }

  function selectModPack(pack: SaveModPackEntry) {
    setServerModPath(pack.path);
    linkModPackToBridge(pack.path);
  }

  async function handleOpenModPack(pack: SaveModPackEntry) {
    useBridgeStore.getState().setLastError(null);
    try {
      const path = await openSaveModPackByPath(pack.path, openFile);
      setServerModPath(path);
    } catch (err) {
      useBridgeStore.getState().setLastError(`Could not open mod pack: ${err}`);
    }
  }

  const saveModPacks = discovery?.saveModPacks ?? [];

  async function applyTestModPackPath() {
    if (!testModFolder) return;
    try {
      const saveName = discovery?.saveName ?? resolveBridgeDiscoveryHints(serverModPath, useProjectStore.getState().projectPath).saveName;
      const path = await resolveSaveModPackRootByFolder(testModFolder, saveName);
      setServerModPath(path);
      useBridgeStore.getState().setServerModPath(path);
    } catch {
      useBridgeStore.getState().setLastError(`Could not resolve test mod path for ${testModFolder}`);
    }
  }

  const bridgeReady = Boolean(discovery?.portOpen && discovery?.bridgeVersion && !connected);

  const statusColor = connected
    ? "text-emerald-400"
    : connecting
      ? "text-amber-400"
      : bridgeReady
        ? "text-amber-400"
        : "text-tn-text-muted";

  const statusText = connected
    ? "Connected"
    : connecting
      ? "Connecting..."
      : bridgeReady
        ? "Ready"
        : "Disconnected";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-tn-panel border border-tn-border rounded-lg shadow-xl w-[540px] max-h-[85vh] overflow-y-auto p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Bridge Connection</h2>
          <span className={`text-xs font-medium ${statusColor}`}>{statusText}</span>
        </div>

        <div className="inline-flex rounded-lg border border-tn-border p-0.5 self-start">
          {(["simple", "advanced"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setUiMode(mode)}
              aria-pressed={uiMode === mode}
              className={`px-2.5 py-1 text-[10px] uppercase tracking-wide rounded-md transition-colors ${
                uiMode === mode
                  ? "bg-tn-accent/20 text-tn-accent"
                  : "text-tn-text-muted hover:text-tn-text"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {uiMode === "advanced" && <BridgeDebugPanel />}

        {/* Auto-discovery */}
        <div className="rounded border border-tn-border bg-tn-bg/80 px-2.5 py-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-tn-text">Detected environment</span>
            <button
              type="button"
              onClick={() => void refreshDiscovery({ host, port, authToken, serverModPath })}
              disabled={discoveryProbing}
              className="text-[10px] px-2 py-0.5 rounded border border-tn-border hover:bg-tn-accent/15 disabled:opacity-50"
            >
              {discoveryProbing ? "Checking…" : "Refresh"}
            </button>
          </div>
          {discoveryProbing && !discovery?.portOpen && (
            <p className="text-[10px] text-tn-text-muted">
              Scanning {host}:{port}
              {serverModPath
                ? ` for mod ${serverModPath.split(/[/\\]/).pop()}`
                : ` (set Server mod path or open a save mod pack)`}
              …
            </p>
          )}
          {discovery && (
            <div className="text-[10px] text-tn-text-muted grid grid-cols-2 gap-x-2 gap-y-0.5">
              <span>
                Listener:{" "}
                <span className={discovery.portOpen ? "text-emerald-400" : "text-red-400"}>
                  {discovery.portOpen ? `up :${port}` : "offline"}
                </span>
              </span>
              <span>
                Mode:{" "}
                <span className="text-tn-text">
                  {discovery.bridgeVersion?.includes("sidecar")
                    ? "sidecar"
                    : discovery.bridgeMode ?? "—"}
                  {discovery.bridgeVersion ? ` (${discovery.bridgeVersion})` : ""}
                </span>
              </span>
              {discovery.bridgeVersion?.includes("sidecar") && (
                <span className="col-span-2 text-amber-400/90 leading-snug">
                  Sidecar: player/world follow the save + server log. Preview → World reads
                  saved region files when present; missing chunks use a synthetic fallback.
                </span>
              )}
              <span className="col-span-2">Save: {discovery.saveName}</span>
              {(discovery.modPackFolder || serverModPath) && (
                <span className="col-span-2 truncate" title={discovery.modPackPath ?? serverModPath}>
                  Mod pack: {discovery.modPackFolder ?? serverModPath.split(/[/\\]/).pop()}
                </span>
              )}
              {discovery.playerName && (
                <>
                  <span>Player: {discovery.playerName}</span>
                  <span>
                    World: {formatBridgeWorldLabel(discovery.playerWorld, discovery.playerWorldLabel)}
                    {discovery.playerWorldLive ? (
                      <span className="text-emerald-400 ml-1">(live)</span>
                    ) : discovery.hytaleSessionActive === false ? (
                      <span className="text-amber-400/90 ml-1">(last known)</span>
                    ) : null}
                  </span>
                  {bridgeLiveStatusHint(
                    discovery.playerWorldLive,
                    discovery.hytaleSessionActive,
                  ) && (
                    <span className="col-span-2 text-tn-text-muted/90">
                      {bridgeLiveStatusHint(
                        discovery.playerWorldLive,
                        discovery.hytaleSessionActive,
                      )}
                    </span>
                  )}
                  {bridgeWorldSourceHint(discovery.playerWorldSource) && (
                    <span className="col-span-2 text-tn-text-muted/90">
                      {bridgeWorldSourceHint(discovery.playerWorldSource)}
                    </span>
                  )}
                  {discovery.playerSaveWorldId &&
                    discovery.playerWorld &&
                    discovery.playerSaveWorldId !== discovery.playerWorld && (
                      <span className="col-span-2 text-amber-400/90">
                        Player save still lists{" "}
                        {formatBridgeWorldLabel(discovery.playerSaveWorldId)} — using live
                        world above.
                      </span>
                    )}
                  {bridgeReady && !connecting && (
                    <span className="col-span-2 text-amber-400/95">
                      Sidecar is up — World preview and chunk load require Connect (auto-connect{" "}
                      {isBridgeAutoConnectEnabled() ? "on" : "off"}).
                    </span>
                  )}
                  {(discovery.instanceWorlds?.length ?? 0) > 0 && (
                    <span className="col-span-2">
                      Instances:{" "}
                      {discovery
                        .instanceWorlds!.filter(
                          (w) =>
                            w.isLive ||
                            !w.label.toLowerCase().includes("unknown_worlds"),
                        )
                        .map((w) => (
                        <span
                          key={w.worldId}
                          className={
                            w.isLive ? "text-emerald-400 mr-2" : "text-tn-text-muted mr-2"
                          }
                          title={w.worldId}
                        >
                          {w.label}
                          {w.isLive ? " (live)" : ""}
                        </span>
                      ))}
                    </span>
                  )}
                  {discovery.playerPositionStale && (
                    <span className="col-span-2 text-amber-400/90">
                      In-game position not in the save yet — enter block coords in Teleport below
                      and click &quot;Use for preview&quot;
                      {discovery.chunkX != null && discovery.chunkZ != null
                        ? ` (chunk ${discovery.chunkX}, ${discovery.chunkZ}).`
                        : "."}
                    </span>
                  )}
                  {bridgeChunkOnDiskHint(discovery.playerChunkOnDisk) && (
                    <span
                      className={`col-span-2 ${
                        discovery.playerChunkOnDisk ? "text-emerald-400/90" : "text-amber-400/90"
                      }`}
                    >
                      {bridgeChunkOnDiskHint(discovery.playerChunkOnDisk)}
                    </span>
                  )}
                  {discovery.chunkX != null && discovery.chunkZ != null && (
                    <span className="col-span-2">
                      Position chunk: {discovery.chunkX}, {discovery.chunkZ}
                      {discovery.playerX != null && discovery.playerZ != null && (
                        <span className="text-tn-text-muted/80">
                          {" "}
                          (block {Math.floor(discovery.playerX)},{" "}
                          {discovery.playerY != null ? Math.floor(discovery.playerY) : "?"},{" "}
                          {Math.floor(discovery.playerZ)})
                        </span>
                      )}
                    </span>
                  )}
                  {discovery.playerPositionSource && (
                    <span
                      className="col-span-2 text-[10px] text-tn-text-muted/90"
                      title={bridgePositionSourceHint(discovery.playerPositionSource) ?? undefined}
                    >
                      Position source:{" "}
                      {livePlayerPositionSourceLabel(discovery.playerPositionSource)}
                    </span>
                  )}
                </>
              )}
              {discovery.authTokenFromConfig && !authToken && (
                <span className="col-span-2 text-amber-400">Token found in save — paste applied on Refresh</span>
              )}
              {discovery.error && (
                <span className="col-span-2 text-amber-400">{discovery.error}</span>
              )}
            </div>
          )}
        </div>

        {/* Connection Config */}
        <div className="flex flex-col gap-3">
          {uiMode === "advanced" && (
          <>
          <div className="flex gap-2">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-tn-text-muted">Host</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="127.0.0.1"
                disabled={connected || connecting}
                className="px-2 py-1.5 text-sm bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1 w-24">
              <label className="text-xs text-tn-text-muted">Port</label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="7854"
                disabled={connected || connecting}
                className="px-2 py-1.5 text-sm bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-tn-text-muted">Auth Token</label>
            <div className="flex gap-2">
              <input
                type={showToken ? "text" : "password"}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Enter auth token..."
                disabled={connected || connecting}
                className="flex-1 px-2 py-1.5 text-sm bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none disabled:opacity-50"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="px-2 py-1.5 text-xs bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20"
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          </>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-tn-text-muted">
              Mod packs on save {discovery?.saveName ? `"${discovery.saveName}"` : ""}
            </label>
            <p className="text-[10px] text-tn-text-muted leading-snug">
              TerraNova ensures <span className="font-mono">{TERRANOVA_BRIDGE_MOD_FOLDER}</span> exists
              under this save&apos;s <span className="font-mono">mods</span> folder (enable it in Hytale).
              Pick any pack to sync into — each must be a folder with <span className="font-mono">Server/</span>,
              not the parent <span className="font-mono">mods</span> directory.
            </p>
            {saveModPacks.length > 0 ? (
              <ul className="max-h-40 overflow-y-auto rounded border border-tn-border bg-tn-bg/60 divide-y divide-tn-border/60">
                {saveModPacks.map((pack) => {
                  const selected = isSelectedModPack(serverModPath, pack.path);
                  return (
                    <li
                      key={pack.path}
                      className={`flex flex-wrap items-center gap-1.5 px-2 py-1.5 text-[10px] ${
                        selected ? "bg-tn-accent/10" : ""
                      }`}
                    >
                      {pack.isBridgePack && (
                        <img
                          src="/icons/terranova.svg"
                          alt=""
                          className="h-5 w-5 shrink-0 rounded-sm border border-tn-border/60"
                          aria-hidden
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => selectModPack(pack)}
                        className={`min-w-0 flex-1 text-left font-mono truncate hover:underline ${
                          selected ? "text-tn-accent font-medium" : "text-tn-text"
                        }`}
                        title={pack.path}
                      >
                        {pack.folderName}
                        {pack.isBridgePack && (
                          <span className="ml-1 text-tn-accent/90 font-sans">(Bridge)</span>
                        )}
                        {!pack.hasWorldgen && (
                          <span className="ml-1 text-amber-400/90 font-sans">(no Server/HytaleGenerator)</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleOpenModPack(pack)}
                        className="shrink-0 px-1.5 py-0.5 rounded border border-tn-border hover:bg-tn-accent/15"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => selectModPack(pack)}
                        className={`shrink-0 px-1.5 py-0.5 rounded border ${
                          selected
                            ? "border-tn-accent/50 bg-tn-accent/20 text-tn-text"
                            : "border-tn-border hover:bg-tn-accent/15"
                        }`}
                      >
                        {selected ? "Sync target" : "Use"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[10px] text-tn-text-muted italic">
                {discoveryProbing
                  ? "Scanning mods folder…"
                  : "Refresh detection after setting a mod path or opening a project under Saves/…/mods."}
              </p>
            )}
            {testModFolder && saveModPacks.every((p) => p.folderName !== testModFolder) && (
              <button
                type="button"
                onClick={() => void applyTestModPackPath()}
                className="self-start px-2 py-0.5 text-[10px] rounded border border-tn-accent/50 bg-tn-accent/15 text-tn-text hover:bg-tn-accent/25"
                title={`Export Asset Pack creates ${testModFolder} under this save's mods folder`}
              >
                My test mod ({testModFolder})
              </button>
            )}
            {uiMode === "advanced" && (
            <div className="flex gap-2">
              <input
                type="text"
                value={serverModPath}
                onChange={(e) => setServerModPath(e.target.value)}
                placeholder="e.g. ...\Saves\Worldgen V1\mods\McCal.Volume Lab"
                className="flex-1 px-2 py-1.5 text-sm bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none text-tn-text-muted"
              />
              <button
                onClick={handleBrowseModPath}
                className="px-3 py-1.5 text-sm bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20"
              >
                Browse
              </button>
            </div>
            )}
          </div>

          {/* Connect / Disconnect button */}
          <div className="flex gap-2">
            {connected ? (
              <button
                onClick={handleDisconnect}
                className="px-4 py-1.5 text-sm rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="px-4 py-1.5 text-sm rounded bg-tn-accent text-tn-bg font-medium disabled:opacity-50 hover:opacity-90"
              >
                {connecting ? "Connecting..." : "Connect"}
              </button>
            )}
          </div>
        </div>

        {/* Error display */}
        {lastError && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
            {lastError}
          </p>
        )}

        {lastNotice && !lastError && (
          <p className="text-xs text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1.5">
            {lastNotice}
          </p>
        )}

        {/* Actions section (only when connected) */}
        {connected && (
          <>
            <div className="border-t border-tn-border pt-3">
              <h3 className="text-sm font-medium mb-2">Server Info</h3>
              {serverStatus && (
                <div className="text-xs text-tn-text-muted grid grid-cols-2 gap-1">
                  <span>Status: <span className="text-emerald-400">{serverStatus.status}</span></span>
                  <span>Bridge: v{serverStatus.bridge_version}</span>
                  <span>Players: {serverStatus.player_count}</span>
                  <span>Port: {serverStatus.port}</span>
                  <span>Mode: {serverStatus.singleplayer ? "Singleplayer" : "Dedicated"}</span>
                  {serverStatus.save_root && (
                    <span className="col-span-2 truncate" title={serverStatus.save_root}>
                      Save root: {serverStatus.save_root}
                    </span>
                  )}
                </div>
              )}
              {serverStatus?.singleplayer && (
                <p className="mt-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5">
                  Singleplayer mode — chunk loading is throttled to reduce memory pressure on the shared JVM.
                </p>
              )}
            </div>

            <div className="border-t border-tn-border pt-3 flex flex-col gap-3">
              <h3 className="text-sm font-medium">Actions</h3>
              {(serverStatus?.bridge_mode === "sidecar" ||
                serverStatus?.bridge_version?.includes("sidecar")) && (
                <p className="text-[10px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5 leading-snug">
                  Sidecar mode: Reload / Regen / Teleport append real console lines to{" "}
                  <span className="font-mono">bridge/pending-commands.log</span> — paste into the
                  Hytale server console (see <span className="font-mono">bridge/ITERATION.md</span>
                  ) or wait for the JVM TerraNovaBridge plugin.
                </p>
              )}

              {uiMode === "advanced" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReloadWorldgen}
                  className="px-3 py-1.5 text-sm bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20"
                >
                  Reload Worldgen
                </button>
                <span className="text-xs text-tn-text-muted">
                  {serverStatus?.bridge_mode === "sidecar" ||
                  serverStatus?.bridge_version?.includes("sidecar")
                    ? "Queues /worldgen reload (sidecar)"
                    : "Triggers server worldgen reload"}
                </span>
              </div>
              )}

              {/* Sync & Reload */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncAndReload}
                  className="px-3 py-1.5 text-sm bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20"
                >
                  Sync & Reload
                </button>
                <span className="text-xs text-tn-text-muted">Copy current file to server + reload</span>
              </div>

              {uiMode === "advanced" && (
              <>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-tn-text-muted">Live-reload viewport (in-game console)</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-[10px] text-tn-text-muted">Radius</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={viewportRadius}
                    onChange={(e) => setViewportRadius(e.target.value)}
                    className="w-16 px-2 py-1 text-xs bg-tn-bg border border-tn-border rounded font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const radius = Math.max(1, parseInt(viewportRadius, 10) || 64);
                      const command = `/viewport --radius ${radius}`;
                      void navigator.clipboard.writeText(command).then(() => {
                        setViewportCopied(true);
                        window.setTimeout(() => setViewportCopied(false), 2000);
                      });
                    }}
                    className="px-3 py-1.5 text-sm bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20"
                  >
                    {viewportCopied ? "Copied!" : "Copy viewport command"}
                  </button>
                  <span className="text-[10px] font-mono text-tn-text-muted">
                    /viewport --radius {Math.max(1, parseInt(viewportRadius, 10) || 64)}
                  </span>
                </div>
              </div>

              {/* Regenerate Chunks */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-tn-text-muted">Regenerate Chunks</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={regenX}
                    onChange={(e) => setRegenX(e.target.value)}
                    placeholder="X"
                    className="w-16 px-2 py-1 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none"
                  />
                  <input
                    type="text"
                    value={regenZ}
                    onChange={(e) => setRegenZ(e.target.value)}
                    placeholder="Z"
                    className="w-16 px-2 py-1 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none"
                  />
                  <input
                    type="text"
                    value={regenRadius}
                    onChange={(e) => setRegenRadius(e.target.value)}
                    placeholder="R"
                    className="w-16 px-2 py-1 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none"
                  />
                  <button
                    onClick={handleRegenChunks}
                    className="px-3 py-1 text-xs bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20"
                  >
                    Regen
                  </button>
                </div>
              </div>

              {/* Teleport */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-tn-text-muted">Teleport Player</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tpPlayer}
                    onChange={(e) => setTpPlayer(e.target.value)}
                    placeholder="Player"
                    className="w-24 px-2 py-1 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none"
                  />
                  <input
                    type="text"
                    value={tpX}
                    onChange={(e) => setTpX(e.target.value)}
                    placeholder="X"
                    className="w-14 px-2 py-1 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none"
                  />
                  <input
                    type="text"
                    value={tpY}
                    onChange={(e) => setTpY(e.target.value)}
                    placeholder="Y"
                    className="w-14 px-2 py-1 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none"
                  />
                  <input
                    type="text"
                    value={tpZ}
                    onChange={(e) => setTpZ(e.target.value)}
                    placeholder="Z"
                    className="w-14 px-2 py-1 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none"
                  />
                  <button
                    onClick={handleTeleport}
                    disabled={!tpPlayer.trim()}
                    className="px-3 py-1 text-xs bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20 disabled:opacity-50"
                  >
                    TP
                  </button>
                  <button
                    type="button"
                    onClick={applyCoordsToPreview}
                    className="px-3 py-1 text-xs bg-tn-accent/20 border border-tn-accent/40 rounded hover:bg-tn-accent/30"
                    title="Set Preview → World chunk center from X/Z (block coords)"
                  >
                    Use for preview
                  </button>
                </div>
              </div>
              </>
              )}

              {uiMode === "advanced" && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGetPlayerInfo}
                    className="px-3 py-1.5 text-sm bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20"
                  >
                    Get Player Info
                  </button>
                </div>
                {playerInfo && (
                  <div className="text-xs text-tn-text-muted mt-1 bg-tn-bg rounded px-2 py-1.5 border border-tn-border">
                    <span className="text-tn-text">{playerInfo.name}</span>
                    {playerInfo.x != null && (
                      <span className="ml-2">
                        ({playerInfo.x.toFixed(1)}, {playerInfo.y?.toFixed(1)}, {playerInfo.z?.toFixed(1)})
                      </span>
                    )}
                    {playerInfo.world && <span className="ml-2">[{playerInfo.world}]</span>}
                  </div>
                )}
              </div>
              )}
            </div>
          </>
        )}

        {/* Close button */}
        <div className="flex justify-end pt-2 border-t border-tn-border">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
