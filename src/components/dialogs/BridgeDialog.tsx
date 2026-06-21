import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useBridgeStore } from "@/stores/bridgeStore";
import { useBridge } from "@/hooks/useBridge";
import { useTauriIO } from "@/hooks/useTauriIO";
import { useProjectStore } from "@/stores/projectStore";
import {
  bridgeDiscover,
  bridgePluginStatus,
  bridgeDeployPlugin,
  readAssetFile,
  type SaveModPackEntry,
  type PluginStatus,
} from "@/utils/ipc";
import {
  bridgeLiveStatusHint,
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
import { useSettingsStore } from "@/stores/settingsStore";
import {
  deriveTerraNovaModFolderName,
  TERRANOVA_BRIDGE_MOD_FOLDER,
} from "@/utils/hytaleModPaths";
import {
  resolveDefaultSaveModsBrowseRoot,
  resolveSaveModPackRootByFolder,
  setLastBridgeSaveName,
} from "@/utils/hytaleSavePaths";
import { linkModPackToBridge, openSaveModPackByPath } from "@/utils/saveModWorkflow";
import { BridgeDebugPanel } from "@/components/bridge/BridgeDebugPanel";
import { bridgeStartSidecar } from "@/utils/ipc";

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

/** Small colored dot indicator */
function StatusDot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  const color = ok ? "bg-emerald-400" : warn ? "bg-amber-400" : "bg-red-400/80";
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${color}`} />;
}

/** Collapsible card section */
function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-tn-border bg-tn-bg/60">
      <div className="px-3 py-1.5 border-b border-tn-border/60">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-tn-text-muted">
          {label}
        </span>
      </div>
      <div className="px-3 py-2.5 flex flex-col gap-2">{children}</div>
    </div>
  );
}

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
  const [uiMode, setUiMode] = useState<"simple" | "advanced">("simple");

  // Plugin state
  const [pluginStatus, setPluginStatus] = useState<PluginStatus | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState<string | null>(null);

  // Regen / teleport / viewport (advanced)
  const [regenX, setRegenX] = useState("0");
  const [regenZ, setRegenZ] = useState("0");
  const [regenRadius, setRegenRadius] = useState("3");
  const [viewportRadius, setViewportRadius] = useState("64");
  const [viewportCopied, setViewportCopied] = useState(false);
  const [tpPlayer, setTpPlayer] = useState("");
  const [tpX, setTpX] = useState("0");
  const [tpY, setTpY] = useState("64");
  const [tpZ, setTpZ] = useState("0");
  const [playerInfo, setPlayerInfo] = useState<{
    name: string;
    x?: number;
    y?: number;
    z?: number;
    world?: string;
  } | null>(null);
  const [startingSidecar, setStartingSidecar] = useState(false);

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

  const hytaleAssetSourceChannel = useSettingsStore((s) => s.hytaleAssetSourceChannel);

  const refreshPluginStatus = useCallback(async () => {
    try {
      const s = await bridgePluginStatus(hytaleAssetSourceChannel);
      setPluginStatus(s);
    } catch {
      // not critical
    }
  }, [hytaleAssetSourceChannel]);

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
      if (result.saveName) setLastBridgeSaveName(result.saveName);
      const suggested = result.suggestedModPackPath ?? result.bridgeModPackPath;
      if (!config.serverModPath && suggested) {
        setServerModPath(suggested);
        useBridgeStore.getState().setServerModPath(suggested);
      }
      if (result.authTokenFromConfig) {
        const tokenRejected = result.error
          ?.toLowerCase()
          .includes("rejected the token");
        const shouldSyncToken =
          !config.authToken.trim() ||
          Boolean(tokenRejected) ||
          config.authToken !== result.authTokenFromConfig;
        if (shouldSyncToken) {
          setAuthToken(result.authTokenFromConfig);
          useBridgeStore
            .getState()
            .setConnectionConfig(config.host, portNum, result.authTokenFromConfig);
        }
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
      const h = resolveBridgeDiscoveryHints(
        config.serverModPath,
        useProjectStore.getState().projectPath,
      );
      useBridgeStore.getState().setDiscovery(
        { portOpen: false, saveName: h.saveName ?? "", error: String(err) },
        false,
      );
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const s = useBridgeStore.getState();
      const cfg = {
        host: s.host,
        port: String(s.port),
        authToken: s.authToken,
        serverModPath: s.serverModPath,
      };
      setHost(cfg.host);
      setPort(cfg.port);
      setAuthToken(cfg.authToken);
      setServerModPath(cfg.serverModPath);
      setPlayerInfo(null);
      setDeployMsg(null);
      void refreshDiscovery(cfg);
      void refreshPluginStatus();

      let cancelled = false;
      void (async () => {
        const projectPath = useProjectStore.getState().projectPath;
        if (!projectPath) { setTestModFolder(null); return; }
        let manifestName: string | undefined;
        let searchDir = projectPath;
        for (let i = 0; i < 4; i++) {
          try {
            const raw = await readAssetFile(`${searchDir}/manifest.json`);
            if (raw && typeof raw === "object" && typeof (raw as { name?: string }).name === "string") {
              manifestName = (raw as { name: string }).name;
              break;
            }
          } catch { /* try parent */ }
          const parent = searchDir.replace(/[/\\][^/\\]+$/, "");
          if (parent === searchDir) break;
          searchDir = parent;
        }
        if (cancelled) return;
        setTestModFolder(
          deriveTerraNovaModFolderName(manifestName, projectPath.split(/[/\\]/).pop()),
        );
      })();
      return () => { cancelled = true; };
    }
  }, [isOpen, refreshDiscovery, refreshPluginStatus]);

  if (!isOpen) return null;

  function onClose() { setDialogOpen(false); }

  async function handleDeployPlugin() {
    setDeploying(true);
    setDeployMsg(null);
    try {
      const msg = await bridgeDeployPlugin(hytaleAssetSourceChannel);
      setDeployMsg(msg);
      await refreshPluginStatus();
    } catch (err) {
      setDeployMsg(`Error: ${err}`);
    } finally {
      setDeploying(false);
    }
  }

  async function startSidecarAndRefresh(): Promise<void> {
    setStartingSidecar(true);
    const store = useBridgeStore.getState();
    store.setLastError(null);
    try {
      const hints = resolveBridgeDiscoveryHints(
        serverModPath,
        useProjectStore.getState().projectPath,
      );
      const latestDiscovery = store.discovery;
      const res = await bridgeStartSidecar({
        forceRestartIfListening: true,
        saveRoot: hints.saveRoot ?? latestDiscovery?.saveRoot,
        saveName: hints.saveName ?? latestDiscovery?.saveName,
      });
      if (res.message) {
        store.setLastNotice(res.message);
      }
      const settleDelayMs = res.already_running ? 300 : 900;
      await new Promise((resolve) => window.setTimeout(resolve, settleDelayMs));
      for (let i = 0; i < 10; i++) {
        await refreshDiscovery({ host, port, authToken, serverModPath });
        const latest = useBridgeStore.getState().discovery;
        if (latest?.portOpen && latest.bridgeVersion) {
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
    } catch (err) {
      store.setLastError(`Could not start sidecar: ${String(err)}`);
      throw err;
    } finally {
      setStartingSidecar(false);
    }
  }

  async function handleConnect() {
    const portNum = parseInt(port, 10) || 7854;
    useBridgeStore.getState().setConnectionConfig(host, portNum, authToken);
    if (serverModPath) useBridgeStore.getState().setServerModPath(serverModPath);
    if (!sidecarOnline) {
      await startSidecarAndRefresh();
      // Allow discovery/status to settle after sidecar spawn.
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
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

  async function handleSyncAndReload() {
    if (serverModPath) useBridgeStore.getState().setServerModPath(serverModPath);
    await syncAndReload();
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

  async function handleBrowseModPath() {
    const defaultPath = await resolveDefaultSaveModsBrowseRoot();
    const selected = (await open({
      directory: true,
      title: "Select mod pack root (folder containing Server/)",
      defaultPath,
    })) as string | null;
    if (selected) {
      setServerModPath(selected);
      useBridgeStore.getState().setServerModPath(selected);
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
      const message = String(err);
      if (message.includes("cancelled")) return;
      useBridgeStore.getState().setLastError(`Could not open mod pack: ${err}`);
    }
  }

  async function applyTestModPackPath() {
    if (!testModFolder) return;
    try {
      const saveName =
        discovery?.saveName ??
        resolveBridgeDiscoveryHints(serverModPath, useProjectStore.getState().projectPath).saveName;
      if (!saveName) {
        useBridgeStore.getState().setLastError(
          "No Hytale save known — open Bridge after creating a world, or pick a mod pack path.",
        );
        return;
      }
      const path = await resolveSaveModPackRootByFolder(testModFolder, saveName);
      setServerModPath(path);
      useBridgeStore.getState().setServerModPath(path);
    } catch {
      useBridgeStore.getState().setLastError(`Could not resolve test mod path for ${testModFolder}`);
    }
  }

  const saveModPacks = discovery?.saveModPacks ?? [];
  const sidecarOnline = Boolean(discovery?.portOpen && discovery?.bridgeVersion);
  const bridgeReady = sidecarOnline && !connected;
  const isSidecar =
    serverStatus?.bridge_mode === "sidecar" ||
    serverStatus?.bridge_version?.includes("sidecar") ||
    discovery?.bridgeVersion?.includes("sidecar");

  const statusText = connected
    ? "Connected"
    : connecting
      ? "Connecting…"
      : bridgeReady
        ? "Ready"
        : "Offline";
  const statusColor = connected
    ? "text-emerald-400"
    : connecting
      ? "text-amber-400"
      : bridgeReady
        ? "text-amber-400"
        : "text-tn-text-muted";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-tn-panel border border-tn-border rounded-lg shadow-xl w-[520px] max-h-[90vh] overflow-y-auto flex flex-col gap-3 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Bridge</h2>
            <span className={`text-[10px] font-medium ${statusColor}`}>{statusText}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded border border-tn-border p-0.5">
              {(["simple", "advanced"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setUiMode(m)}
                  aria-pressed={uiMode === m}
                  className={`px-2 py-0.5 text-[10px] uppercase tracking-wide rounded transition-colors ${
                    uiMode === m
                      ? "bg-tn-accent/20 text-tn-accent"
                      : "text-tn-text-muted hover:text-tn-text"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="text-tn-text-muted hover:text-tn-text text-xs px-1.5 py-0.5 rounded hover:bg-tn-surface"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── 1. Plugin ── */}
        <Card label="1 · Plugin">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <StatusDot
                ok={pluginStatus?.installed ?? false}
                warn={!(pluginStatus?.mods_dir_exists ?? true)}
              />
              <span className="text-xs text-tn-text truncate">
                {pluginStatus === null
                  ? "Checking…"
                  : pluginStatus.installed
                    ? pluginStatus.jar_name ?? "TerraNova.Bridge.jar"
                    : pluginStatus.mods_dir_exists
                      ? "Not installed"
                      : "Hytale mods folder not found"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleDeployPlugin()}
              disabled={deploying}
              className="shrink-0 px-3 py-1 text-xs rounded bg-tn-accent text-tn-bg font-medium disabled:opacity-50 hover:opacity-90"
            >
              {deploying ? "Installing…" : pluginStatus?.installed ? "Reinstall" : "Deploy Plugin"}
            </button>
          </div>
          {!pluginStatus?.mods_dir_exists && pluginStatus !== null && (
            <p className="text-[10px] text-amber-400/90">
              Launch Hytale ({hytaleAssetSourceChannel}) at least once to create the mods folder,
              then click Deploy Plugin.
            </p>
          )}
          {pluginStatus?.installed && !deploying && (
            <p className="text-[10px] text-tn-text-muted">
              Enable <span className="font-mono">{TERRANOVA_BRIDGE_MOD_FOLDER}</span> on your save
              in Hytale, then start the sidecar below.
            </p>
          )}
          {deployMsg && (
            <p
              className={`text-[10px] leading-snug ${
                deployMsg.startsWith("Error") ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {deployMsg}
            </p>
          )}
        </Card>

        {/* ── 2. Sidecar ── */}
        <Card label="2 · Sidecar">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusDot ok={sidecarOnline} warn={discoveryProbing && !sidecarOnline} />
              <span className="text-xs text-tn-text">
                {sidecarOnline
                  ? `Online · ${discovery?.bridgeVersion ?? ""}`
                  : discoveryProbing
                    ? `Scanning ${host}:${port}…`
                    : "Offline"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void refreshDiscovery({ host, port, authToken, serverModPath })}
              disabled={discoveryProbing}
              className="text-[10px] px-2 py-0.5 rounded border border-tn-border hover:bg-tn-accent/15 disabled:opacity-50"
            >
              {discoveryProbing ? "Checking…" : "Refresh"}
            </button>
          </div>

          {discovery && (
            <div className="text-[10px] text-tn-text-muted flex flex-col gap-0.5">
              {discovery.saveName && (
                <span>
                  Save:{" "}
                  <span className="text-tn-text">{discovery.saveName}</span>
                </span>
              )}
              {discovery.playerName && (
                <span>
                  Player: <span className="text-tn-text">{discovery.playerName}</span>
                  {" · "}
                  World:{" "}
                  <span className="text-tn-text">
                    {formatBridgeWorldLabel(discovery.playerWorld, discovery.playerWorldLabel)}
                  </span>
                  {discovery.playerWorldLive ? (
                    <span className="text-emerald-400 ml-1">(live)</span>
                  ) : discovery.hytaleSessionActive === false ? (
                    <span className="text-amber-400/90 ml-1">(last known)</span>
                  ) : null}
                </span>
              )}
              {discovery.chunkX != null && discovery.chunkZ != null && (
                <span>
                  Chunk:{" "}
                  <span className="text-tn-text font-mono">
                    {discovery.chunkX}, {discovery.chunkZ}
                  </span>
                  {discovery.playerX != null && (
                    <span className="text-tn-text-muted/70">
                      {" "}(block {Math.floor(discovery.playerX)},{" "}
                      {discovery.playerY != null ? Math.floor(discovery.playerY) : "?"},{" "}
                      {Math.floor(discovery.playerZ ?? 0)})
                    </span>
                  )}
                </span>
              )}
              {bridgeChunkOnDiskHint(discovery.playerChunkOnDisk) && (
                <span className={discovery.playerChunkOnDisk ? "text-emerald-400/90" : "text-amber-400/90"}>
                  {bridgeChunkOnDiskHint(discovery.playerChunkOnDisk)}
                </span>
              )}
              {bridgeLiveStatusHint(discovery.playerWorldLive, discovery.hytaleSessionActive) && (
                <span className="text-tn-text-muted/80">
                  {bridgeLiveStatusHint(discovery.playerWorldLive, discovery.hytaleSessionActive)}
                </span>
              )}
              {discovery.authTokenFromConfig && !authToken && (
                <span className="text-amber-400">Token found in save — paste applied on Refresh</span>
              )}
              {discovery.error && (
                <span className="text-amber-400">{discovery.error}</span>
              )}
              {uiMode === "advanced" && discovery.playerPositionSource && (
                <span
                  className="text-tn-text-muted/70"
                  title={bridgePositionSourceHint(discovery.playerPositionSource) ?? undefined}
                >
                  Position source: {livePlayerPositionSourceLabel(discovery.playerPositionSource)}
                </span>
              )}
              {uiMode === "advanced" && (discovery.instanceWorlds?.length ?? 0) > 0 && (
                <span>
                  Instances:{" "}
                  {discovery.instanceWorlds!
                    .filter((w) => w.isLive || !w.label.toLowerCase().includes("unknown_worlds"))
                    .map((w) => (
                      <span
                        key={w.worldId}
                        className={w.isLive ? "text-emerald-400 mr-2" : "text-tn-text-muted mr-2"}
                        title={w.worldId}
                      >
                        {w.label}{w.isLive ? " (live)" : ""}
                      </span>
                    ))}
                </span>
              )}
            </div>
          )}

          {!sidecarOnline && !discoveryProbing && (
            <div className="text-[10px] text-tn-text-muted flex flex-wrap items-center gap-2 mt-0.5">
              <span>Sidecar is offline.</span>
              <code className="font-mono bg-tn-bg border border-tn-border rounded px-1.5 py-0.5 text-tn-text">
                pnpm bridge:run
              </code>
              <button
                type="button"
                onClick={() => void startSidecarAndRefresh()}
                disabled={startingSidecar}
                className="px-2 py-0.5 rounded border border-tn-accent/60 bg-tn-accent/15 text-[10px] text-tn-accent hover:bg-tn-accent/25 disabled:opacity-50"
              >
                {startingSidecar ? "Starting…" : "Start sidecar"}
              </button>
            </div>
          )}

          {bridgeReady && !connecting && (
            <p className="text-[10px] text-amber-400/90">
              Sidecar is up — connect below (auto-connect{" "}
              {isBridgeAutoConnectEnabled() ? "on" : "off"}).
            </p>
          )}
        </Card>

        {/* ── 3. Connect (pre-connection) ── */}
        {!connected && (
          <Card label="3 · Connect">
            {uiMode === "advanced" && (
              <>
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] text-tn-text-muted">Host</label>
                    <input
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="127.0.0.1"
                      disabled={connecting}
                      className="px-2 py-1 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none disabled:opacity-50"
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-20">
                    <label className="text-[10px] text-tn-text-muted">Port</label>
                    <input
                      type="text"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      placeholder="7854"
                      disabled={connecting}
                      className="px-2 py-1 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-tn-text-muted">Auth Token</label>
                  <div className="flex gap-1.5">
                    <input
                      type={showToken ? "text" : "password"}
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      placeholder="Auto-filled from save…"
                      disabled={connecting}
                      className="flex-1 px-2 py-1 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none disabled:opacity-50"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="px-2 py-1 text-[10px] bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20"
                    >
                      {showToken ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {uiMode === "simple" &&
              discovery?.error?.toLowerCase().includes("rejected the token") && (
                <p className="text-[10px] text-amber-400/90">
                  Sidecar is running for a different save than{" "}
                  {discovery.saveName ? `"${discovery.saveName}"` : "this world"}. Click{" "}
                  <span className="font-medium">Start sidecar</span> to restart for the correct save.
                </p>
              )}
            {uiMode === "simple" &&
              discovery?.authTokenFromConfig &&
              !discovery.error?.toLowerCase().includes("rejected the token") && (
                <p className="text-[10px] text-emerald-400/80">
                  Auth uses the token from this save&apos;s bridge/config.json (local loopback only —
                  not your Hytale account).
                </p>
              )}
            {uiMode === "simple" && !discovery?.authTokenFromConfig && !authToken && (
              <p className="text-[10px] text-amber-400/90">
                No token found yet — start the sidecar and click Refresh, or switch to Advanced to
                enter it manually.
              </p>
            )}

            <button
              onClick={() => void handleConnect()}
              disabled={connecting || startingSidecar}
              className="self-start px-4 py-1.5 text-sm rounded bg-tn-accent text-tn-bg font-medium disabled:opacity-50 hover:opacity-90"
            >
              {startingSidecar ? "Starting sidecar…" : connecting ? "Connecting…" : "Connect"}
            </button>
          </Card>
        )}

        {/* ── 4. Actions (post-connection) ── */}
        {connected && (
          <Card label="4 · Actions">
            {serverStatus && (
              <div className="text-[10px] text-tn-text-muted flex flex-wrap gap-x-3 gap-y-0.5 mb-1">
                <span>
                  Bridge:{" "}
                  <span className="text-tn-text">v{serverStatus.bridge_version}</span>
                </span>
                <span>
                  Players: <span className="text-tn-text">{serverStatus.player_count}</span>
                </span>
                {serverStatus.save_root && (
                  <span className="w-full truncate" title={serverStatus.save_root}>
                    Save: <span className="text-tn-text">{serverStatus.save_root.split(/[/\\]/).slice(-2).join("/")}</span>
                  </span>
                )}
              </div>
            )}

            {isSidecar && (
              <p className="text-[10px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 leading-snug">
                Sidecar mode: Reload/Regen/Teleport queue commands to{" "}
                <span className="font-mono">bridge/pending-commands.log</span> — the JVM plugin
                runs them automatically when enabled.
              </p>
            )}

            {/* Mod packs */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-tn-text-muted">
                Mod packs
                {discovery?.saveName ? ` on "${discovery.saveName}"` : ""}
              </span>
              <p className="text-[10px] text-tn-text-muted leading-snug">
                TerraNova ensures <span className="font-mono">{TERRANOVA_BRIDGE_MOD_FOLDER}</span>{" "}
                exists under this save&apos;s{" "}
                <span className="font-mono">mods</span> folder (enable in Hytale). Pick a pack to
                sync into — each must contain <span className="font-mono">Server/</span>.
              </p>
              {saveModPacks.length > 0 ? (
                <ul className="max-h-36 overflow-y-auto rounded border border-tn-border bg-tn-bg/60 divide-y divide-tn-border/60">
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
                            className="h-4 w-4 shrink-0 rounded-sm border border-tn-border/60"
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
                              ? "border-tn-accent/50 bg-tn-accent/20"
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
                    : "No mod packs found — open a project under Saves/…/mods."}
                </p>
              )}
              {testModFolder && saveModPacks.every((p) => p.folderName !== testModFolder) && (
                <button
                  type="button"
                  onClick={() => void applyTestModPackPath()}
                  className="self-start px-2 py-0.5 text-[10px] rounded border border-tn-accent/50 bg-tn-accent/15 hover:bg-tn-accent/25"
                >
                  My test mod ({testModFolder})
                </button>
              )}
              {uiMode === "advanced" && (
                <div className="flex gap-2 mt-0.5">
                  <input
                    type="text"
                    value={serverModPath}
                    onChange={(e) => setServerModPath(e.target.value)}
                    placeholder="…\Saves\MyWorld\mods\Author.PackName"
                    className="flex-1 px-2 py-1 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none text-tn-text-muted"
                  />
                  <button
                    onClick={() => void handleBrowseModPath()}
                    className="px-2 py-1 text-xs bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20"
                  >
                    Browse
                  </button>
                </div>
              )}
            </div>

            {/* Sync & Reload */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => void handleSyncAndReload()}
                className="px-3 py-1.5 text-sm bg-tn-accent text-tn-bg font-medium rounded hover:opacity-90"
              >
                Sync & Reload
              </button>
              <span className="text-[10px] text-tn-text-muted">Copy current file to server + reload worldgen</span>
            </div>

            {/* Advanced actions */}
            {uiMode === "advanced" && (
              <>
                <div className="border-t border-tn-border/60 pt-2 flex flex-col gap-2">

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void reloadWorldgen()}
                      className="px-3 py-1 text-xs bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20"
                    >
                      Reload Worldgen
                    </button>
                    <span className="text-[10px] text-tn-text-muted">
                      {isSidecar ? "Queues /worldgen reload (sidecar)" : "Triggers server reload"}
                    </span>
                  </div>

                  {/* Viewport */}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-[10px] text-tn-text-muted w-12">Viewport</label>
                    <input
                      type="number"
                      min={1}
                      value={viewportRadius}
                      onChange={(e) => setViewportRadius(e.target.value)}
                      className="w-14 px-2 py-0.5 text-xs bg-tn-bg border border-tn-border rounded font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const r = Math.max(1, parseInt(viewportRadius, 10) || 64);
                        void navigator.clipboard.writeText(`/viewport --radius ${r}`).then(() => {
                          setViewportCopied(true);
                          window.setTimeout(() => setViewportCopied(false), 2000);
                        });
                      }}
                      className="px-2 py-0.5 text-xs bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20"
                    >
                      {viewportCopied ? "Copied!" : "Copy command"}
                    </button>
                    <code className="text-[10px] font-mono text-tn-text-muted">
                      /viewport --radius {Math.max(1, parseInt(viewportRadius, 10) || 64)}
                    </code>
                  </div>

                  {/* Regen chunks */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label className="text-[10px] text-tn-text-muted w-12">Regen</label>
                    {[
                      { val: regenX, set: setRegenX, ph: "X" },
                      { val: regenZ, set: setRegenZ, ph: "Z" },
                      { val: regenRadius, set: setRegenRadius, ph: "R" },
                    ].map(({ val, set, ph }) => (
                      <input
                        key={ph}
                        type="text"
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        placeholder={ph}
                        className="w-14 px-2 py-0.5 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none"
                      />
                    ))}
                    <button
                      onClick={() => void handleRegenChunks()}
                      className="px-2 py-0.5 text-xs bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20"
                    >
                      Regen
                    </button>
                  </div>

                  {/* Teleport */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label className="text-[10px] text-tn-text-muted w-12">Teleport</label>
                    <input
                      type="text"
                      value={tpPlayer}
                      onChange={(e) => setTpPlayer(e.target.value)}
                      placeholder="Player"
                      className="w-20 px-2 py-0.5 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none"
                    />
                    {[
                      { val: tpX, set: setTpX, ph: "X" },
                      { val: tpY, set: setTpY, ph: "Y" },
                      { val: tpZ, set: setTpZ, ph: "Z" },
                    ].map(({ val, set, ph }) => (
                      <input
                        key={ph}
                        type="text"
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        placeholder={ph}
                        className="w-12 px-2 py-0.5 text-xs bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none"
                      />
                    ))}
                    <button
                      onClick={() => void handleTeleport()}
                      disabled={!tpPlayer.trim()}
                      className="px-2 py-0.5 text-xs bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20 disabled:opacity-50"
                    >
                      TP
                    </button>
                    <button
                      type="button"
                      onClick={applyCoordsToPreview}
                      className="px-2 py-0.5 text-xs bg-tn-accent/20 border border-tn-accent/40 rounded hover:bg-tn-accent/30"
                      title="Set World preview chunk center from X/Z block coords"
                    >
                      Preview
                    </button>
                  </div>

                  {/* Player info */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleGetPlayerInfo()}
                      className="px-2 py-0.5 text-xs bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20"
                    >
                      Refresh player
                    </button>
                    {playerInfo && (
                      <span className="text-[10px] text-tn-text-muted">
                        <span className="text-tn-text">{playerInfo.name}</span>
                        {playerInfo.x != null && (
                          <span className="ml-1">
                            ({playerInfo.x.toFixed(1)}, {playerInfo.y?.toFixed(1)},{" "}
                            {playerInfo.z?.toFixed(1)})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </Card>
        )}

        {/* ── Notices / Errors ── */}
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

        {/* ── Debug panel (advanced) ── */}
        {uiMode === "advanced" && <BridgeDebugPanel />}

        {/* ── Footer ── */}
        <div className="flex justify-end gap-2 pt-1 border-t border-tn-border">
          {connected && (
            <button
              onClick={() => void handleDisconnect()}
              className="px-3 py-1.5 text-xs rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
            >
              Disconnect
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded border border-tn-border hover:bg-tn-surface"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
