import { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useBridgeStore } from "@/stores/bridgeStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useUIStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useDeveloperMode } from "@/hooks/useDeveloperMode";
import { useUpdateStore } from "@/stores/updateStore";
import { downloadAndInstall, restartToUpdate } from "@/utils/updater";
import { isTauriRuntime } from "@/utils/platform";
import { useStore } from "@xyflow/react";
import { getAppVersion } from "@/utils/fetchReleases";
import { formatBridgeDiscoverySummary } from "@/utils/bridgeDiscovery";
import { StatusBarSep } from "@/components/ui/editorChrome";

export function StatusBar() {
  const currentFile = useProjectStore((s) => s.currentFile);
  const isDirty = useProjectStore((s) => s.isDirty);
  const projectPath = useProjectStore((s) => s.projectPath);
  const lastError = useProjectStore((s) => s.lastError);
  const bridgeConnected = useBridgeStore((s) => s.connected);
  const bridgeConnecting = useBridgeStore((s) => s.connecting);
  const bridgeHost = useBridgeStore((s) => s.host);
  const bridgePort = useBridgeStore((s) => s.port);
  const bridgeDiscovery = useBridgeStore((s) => s.discovery);
  const bridgeDiscoveryProbing = useBridgeStore((s) => s.discoveryProbing);
  const viewMode = usePreviewStore((s) => s.viewMode);
  const instantSaveEnabled = useSettingsStore((s) => s.instantSaveEnabled);
  const devActive = useDeveloperMode();
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);

  // Node/edge/selection counts
  const nodeCount = useEditorStore((s) => s.nodes.length);
  const edgeCount = useEditorStore((s) => s.edges.length);
  const selectedCount = useEditorStore(
    useCallback((s: { nodes: { selected?: boolean }[] }) => s.nodes.reduce((count, n) => count + (n.selected ? 1 : 0), 0), []),
  );

  // Grid/snap state
  const showGrid = useUIStore((s) => s.showGrid);
  const snapToGrid = useUIStore((s) => s.snapToGrid);

  // App version
  const [appVersion, setAppVersion] = useState<string>("");
  useEffect(() => {
    if (!isTauriRuntime()) {
      setAppVersion("browser");
      return;
    }

    void getAppVersion()
      .then(setAppVersion)
      .catch((e: unknown) => {
        console.warn("Failed to get app version:", e);
        setAppVersion("");
      });
  }, []);

  // Update state
  const updateStatus = useUpdateStore((s) => s.status);
  const updateVersion = useUpdateStore((s) => s.version);
  const updateProgress = useUpdateStore((s) => s.progress);

  // Zoom level from ReactFlow store
  const zoom = useStore((s) => s.transform[2]);
  const zoomPercent = Math.round((zoom ?? 1) * 100);

  const bridgeColor = bridgeConnected
    ? "text-emerald-400"
    : bridgeConnecting
      ? "text-amber-400"
      : "text-tn-text-muted";

  const isGraphView = viewMode === "graph" || viewMode === "split";

  return (
    <div
      className="flex min-h-7 shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-tn-border bg-tn-surface px-3 py-1 text-[11px] text-tn-text-muted"
      role="status"
      aria-live="off"
    >
      {lastError ? (
        <span
          className="min-w-[12rem] max-w-[min(100%,42rem)] flex-1 basis-full break-words leading-snug text-red-400 sm:basis-auto"
          role="alert"
          aria-live="polite"
          title={lastError}
        >
          {lastError}
        </span>
      ) : (
        <span className="min-w-0 max-w-[38%] truncate">
          {currentFile ? currentFile.replace(projectPath ?? "", ".") : "No file open"}
        </span>
      )}

      <StatusBarSep />
      <span className="whitespace-nowrap tabular-nums" aria-label={`${nodeCount} nodes`}>
        {nodeCount} nodes
      </span>
      <span className="whitespace-nowrap tabular-nums" aria-label={`${edgeCount} edges`}>
        {edgeCount} edges
      </span>
      {selectedCount > 0 && (
        <span className="whitespace-nowrap text-tn-accent" aria-label={`${selectedCount} items selected`}>
          {selectedCount} selected
        </span>
      )}

      {devActive && selectedNodeId && (
        <span
          className="max-w-[9rem] truncate font-mono text-[10px] text-tn-text-muted/80"
          title={selectedNodeId}
        >
          {selectedNodeId}
        </span>
      )}

      <div className="min-w-2 flex-1" />

      {isGraphView && (
        <>
          <button
            onClick={() => useUIStore.getState().toggleGrid()}
            aria-pressed={showGrid}
            aria-label={`Grid ${showGrid ? "on" : "off"}`}
            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
              showGrid ? "text-tn-accent" : "text-tn-text-muted/45"
            } hover:bg-tn-accent/10`}
          >
            Grid
          </button>
          <button
            onClick={() => useUIStore.getState().toggleSnap()}
            aria-pressed={snapToGrid}
            aria-label={`Snap ${snapToGrid ? "on" : "off"}`}
            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
              snapToGrid ? "text-tn-accent" : "text-tn-text-muted/45"
            } hover:bg-tn-accent/10`}
          >
            Snap
          </button>
          <StatusBarSep />
        </>
      )}

      <span className="w-9 text-right tabular-nums" aria-label={`Zoom ${zoomPercent}%`}>
        {zoomPercent}%
      </span>

      <button
        onClick={() => useBridgeStore.getState().setDialogOpen(true)}
        aria-label={
          bridgeConnected
            ? "Bridge connected"
            : bridgeDiscovery
              ? formatBridgeDiscoverySummary(bridgeDiscovery, bridgeHost, bridgePort)
              : "Bridge disconnected"
        }
        title={
          bridgeConnected
            ? "Bridge connected — open settings"
            : formatBridgeDiscoverySummary(bridgeDiscovery, bridgeHost, bridgePort)
        }
        className="flex max-w-[200px] items-center gap-1 rounded px-1.5 py-0.5 hover:bg-tn-accent/10"
      >
        <span className={bridgeColor} aria-hidden="true">●</span>
        <span className="truncate">
          {bridgeConnected
            ? "Bridge"
            : bridgeDiscoveryProbing
              ? "Bridge…"
              : bridgeDiscovery?.portOpen
                ? "Ready"
                : "Bridge"}
        </span>
      </button>

      <button
        onClick={() => useSettingsStore.getState().toggleInstantSave()}
        aria-pressed={instantSaveEnabled}
        aria-label={`Instant save ${instantSaveEnabled ? "on" : "off"}`}
        className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
          instantSaveEnabled ? "text-sky-400" : "text-tn-text-muted/45"
        } hover:bg-sky-400/10`}
        title={`Instant save (Ctrl+Shift+I)`}
      >
        Instant
      </button>

      <span aria-label={isDirty ? "Unsaved changes" : "File saved"}>
        {isDirty ? (
          <span className="text-amber-400">Unsaved</span>
        ) : (
          <span className="text-emerald-400/90">Saved</span>
        )}
      </span>

      {updateStatus === "available" ? (
        <button
          onClick={downloadAndInstall}
          className="text-tn-accent hover:underline cursor-pointer"
          aria-label={`Download update version ${updateVersion}`}
        >
          v{updateVersion} available
        </button>
      ) : updateStatus === "downloading" ? (
        <span className="text-amber-400" aria-label={`Downloading update, ${updateProgress}% complete`}>Updating {updateProgress}%</span>
      ) : updateStatus === "restarting" ? (
        <span className="text-amber-400" aria-label="Application restarting to apply update">Restarting...</span>
      ) : updateStatus === "ready" ? (
        <button
          onClick={restartToUpdate}
          className="text-emerald-400 hover:underline cursor-pointer"
          aria-label="Restart application to apply update"
        >
          Restart to update
        </button>
      ) : (
        <span aria-label={`Current version ${appVersion}`}>v{appVersion}</span>
      )}
    </div>
  );
}
