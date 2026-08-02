import { useEffect, useRef, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { SettingsNestedCard } from "@/components/ui/settingsPrimitives";
import { CATEGORY_META, type CategoryId, type SettingDeepLink } from "@/settings/registry";
import "@/settings/index";
import { CategoryRail } from "./settings/CategoryRail";
import { CategoryPanel } from "./settings/CategoryPanel";
import { FilesOperations } from "./settings/FilesOperations";
import { SettingsSearchInput, SettingsSearchResults } from "./settings/SettingsSearch";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  resolveDefaultPreReleaseAssetsPath,
  resolveDefaultReleaseAssetsPath,
  resolveDefaultCommonAssetsPath,
} from "@/utils/hytaleDefaultPaths";
import { useUpdateStore } from "@/stores/updateStore";
import { checkForUpdates, downloadAndInstall, restartToUpdate } from "@/utils/updater";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { checkHytaleAssetStaleness, getHytaleAssetCacheRoot, showInFolder, type AssetStalenessInfo } from "@/utils/ipc";
import { formatHytaleSyncToast, runHytaleAssetSync } from "@/utils/hytaleAssetSyncAction";
import { clearAvailableHytaleAssetFoldersCache } from "@/utils/hytaleAssetFolders";
import { clearHytaleAssetsInFolderCache } from "@/utils/getHytaleAssetsInFolder";
import { useBugReportStore } from "@/stores/bugReportStore";
import { useToastStore } from "@/stores/toastStore";
import { WhatsNewDialog } from "./WhatsNewDialog";
import { ChangelogDialog } from "./ChangelogDialog";
import { LegalTextDialog } from "./LegalTextDialog";
import licenseText from "../../../LICENSE?raw";
import noticeText from "../../../NOTICE?raw";
import {
  markWhatsNewSeen,
  setWhatsNewSuppressed,
} from "@/utils/whatsNewPrefs";
import { SystemSettingsPanel, type SystemTab } from "./ConfigurationDialog";
import { AccountSettingsPanel } from "./AccountSettingsPanel";
import { KeyboardShortcutsPanel } from "./KeyboardShortcutsDialog";
import { clearHardwareDetectionCache, detectHardware, type HardwareInfo } from "@/utils/hardwareDetect";
import { isTauriRuntime } from "@/utils/platform";
import { getAppVersion } from "@/utils/fetchReleases";
import { copyTextToClipboard } from "@/utils/devTools";
import { buildBugReportBundle, formatBugReportClipboard } from "@/utils/bugReport";
import { useDeveloperMode } from "@/hooks/useDeveloperMode";
import { useDevMetricsStore } from "@/stores/devMetricsStore";
import { DevSettingRow } from "@/components/dev/devUi";
import { AlertTriangle } from "lucide-react";

/**
 * Settings categories now come from the registry (CATEGORY_META). This alias
 * remains so existing callers — App.tsx, HomeScreen, uiStore deep links — keep
 * compiling; the legacy ids are mapped in LEGACY_TAB_ALIASES below.
 */
export type SettingsTab = CategoryId;

/** Old tab ids that may still arrive from persisted deep links. */
const LEGACY_TAB_ALIASES: Record<string, CategoryId> = {
  system: "performance",
  assets: "assets",
};

function resolveTab(tab: string | undefined): CategoryId {
  if (!tab) return "general";
  if (LEGACY_TAB_ALIASES[tab]) return LEGACY_TAB_ALIASES[tab]!;
  return CATEGORY_META.some((c) => c.id === tab) ? (tab as CategoryId) : "general";
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  initialSystemTab?: SystemTab;
  onOpenAlphaChecklist?: () => void;
}

function formatSyncedAt(syncedAt: string): string {
  const secs = Date.parse(syncedAt) / 1000;
  if (Number.isNaN(secs)) return syncedAt;
  const nowSecs = Date.now() / 1000;
  const diff = Math.floor(nowSecs - secs);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function SettingsDialog({ open, onClose, initialTab = "general", initialSystemTab = "cpu", onOpenAlphaChecklist }: SettingsDialogProps) {
  const exportPath = useSettingsStore((s) => s.exportPath);
  const setExportPath = useSettingsStore((s) => s.setExportPath);
  const hytaleAssetSyncEnabled = useSettingsStore((s) => s.hytaleAssetSyncEnabled);
  const setHytaleAssetSyncEnabled = useSettingsStore((s) => s.setHytaleAssetSyncEnabled);
  const hytaleAssetSourceChannel = useSettingsStore((s) => s.hytaleAssetSourceChannel);
  const setHytaleAssetSourceChannel = useSettingsStore((s) => s.setHytaleAssetSourceChannel);
  const hytalePreReleaseAssetsPath = useSettingsStore((s) => s.hytalePreReleaseAssetsPath);
  const setHytalePreReleaseAssetsPath = useSettingsStore((s) => s.setHytalePreReleaseAssetsPath);
  const hytaleReleaseAssetsPath = useSettingsStore((s) => s.hytaleReleaseAssetsPath);
  const setHytaleReleaseAssetsPath = useSettingsStore((s) => s.setHytaleReleaseAssetsPath);
  const hytaleCommonAssetsEnabled = useSettingsStore((s) => s.hytaleCommonAssetsEnabled);
  const setHytaleCommonAssetsEnabled = useSettingsStore((s) => s.setHytaleCommonAssetsEnabled);
  const hytaleCommonAssetsPath = useSettingsStore((s) => s.hytaleCommonAssetsPath);
  const setHytaleCommonAssetsPath = useSettingsStore((s) => s.setHytaleCommonAssetsPath);
  const developerMode = useSettingsStore((s) => s.developerMode);
  const setDeveloperMode = useSettingsStore((s) => s.setDeveloperMode);
  const autoEnableDeveloperModeInDev = useSettingsStore((s) => s.autoEnableDeveloperModeInDev);
  const setAutoEnableDeveloperModeInDev = useSettingsStore((s) => s.setAutoEnableDeveloperModeInDev);
  const showDevToolsDock = useSettingsStore((s) => s.showDevToolsDock);
  const setShowDevToolsDock = useSettingsStore((s) => s.setShowDevToolsDock);
  const debugWorkerLogging = useSettingsStore((s) => s.debugWorkerLogging);
  const setDebugWorkerLogging = useSettingsStore((s) => s.setDebugWorkerLogging);
  const showNodeIdsOnCanvas = useSettingsStore((s) => s.showNodeIdsOnCanvas);
  const setShowNodeIdsOnCanvas = useSettingsStore((s) => s.setShowNodeIdsOnCanvas);
  const showPerformanceOverlay = useDevMetricsStore((s) => s.showPerformanceOverlay);
  const setShowPerformanceOverlay = useDevMetricsStore((s) => s.setShowPerformanceOverlay);
  const devActive = useDeveloperMode();
  const addToast = useToastStore((s) => s.addToast);

  const updateStatus = useUpdateStore((s) => s.status);
  const updateVersion = useUpdateStore((s) => s.version);
  const updateProgress = useUpdateStore((s) => s.progress);

  const [tab, setTab] = useState<CategoryId>(resolveTab(initialTab));
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const searching = query.trim().length > 0;
  const [appVersion, setAppVersion] = useState("");
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [legalDialog, setLegalDialog] = useState<"license" | "notice" | null>(null);
  const [hytaleAssetCacheRoot, setHytaleAssetCacheRoot] = useState("");
  const [syncingHytaleAssets, setSyncingHytaleAssets] = useState(false);
  const [stalenessInfo, setStalenessInfo] = useState<AssetStalenessInfo | null>(null);
  const [checkingStaleness, setCheckingStaleness] = useState(false);
  const [examplePreReleasePath, setExamplePreReleasePath] = useState("");
  const [exampleReleasePath, setExampleReleasePath] = useState("");
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [refreshingHardware, setRefreshingHardware] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) {
      setAppVersion("browser preview");
      return;
    }

    void getAppVersion().then(setAppVersion).catch(() => setAppVersion(""));
    void resolveDefaultPreReleaseAssetsPath().then(setExamplePreReleasePath).catch(() => setExamplePreReleasePath(""));
    void resolveDefaultReleaseAssetsPath().then(setExampleReleasePath).catch(() => setExampleReleasePath(""));
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab(resolveTab(initialTab));
    setQuery("");
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    void getHytaleAssetCacheRoot()
      .then(setHytaleAssetCacheRoot)
      .catch(() => setHytaleAssetCacheRoot(""));
  }, [open]);

  useEffect(() => {
    if (!open || (tab !== "performance" && tab !== "developer")) return;
    void detectHardware()
      .then(setHardwareInfo)
      .catch(() => setHardwareInfo(null));
  }, [open, tab]);


  async function handleBrowseExportPath() {
    if (!isTauriRuntime()) {
      addToast("Folder browsing is available in the TerraNova desktop app.", "warning");
      return;
    }
    const selected = await openDialog({ directory: true, defaultPath: exportPath ?? undefined });
    if (typeof selected === "string") setExportPath(selected);
  }




  const activeHytaleSourcePath = hytaleAssetSourceChannel === "pre-release"
    ? hytalePreReleaseAssetsPath
    : hytaleReleaseAssetsPath;

  useEffect(() => {
    if (!open || !activeHytaleSourcePath.trim()) return;
    setCheckingStaleness(true);
    void checkHytaleAssetStaleness(activeHytaleSourcePath, hytaleAssetSourceChannel)
      .then(setStalenessInfo)
      .catch(() => setStalenessInfo(null))
      .finally(() => setCheckingStaleness(false));
  }, [open, activeHytaleSourcePath, hytaleAssetSourceChannel]);

  function setActiveHytaleSourcePath(path: string) {
    if (hytaleAssetSourceChannel === "pre-release") {
      setHytalePreReleaseAssetsPath(path);
      return;
    }
    setHytaleReleaseAssetsPath(path);
  }

  async function handleBrowseHytaleAssetSource() {
    if (!isTauriRuntime()) {
      addToast("Folder browsing is available in the TerraNova desktop app.", "warning");
      return;
    }
    const selected = await openDialog(
      hytaleAssetSourceChannel === "pre-release"
        ? { directory: false, defaultPath: activeHytaleSourcePath, filters: [{ name: "Zip", extensions: ["zip"] }] }
        : { directory: true, defaultPath: activeHytaleSourcePath },
    );
    if (typeof selected === "string") setActiveHytaleSourcePath(selected);
  }

  async function handleBrowseCommonAssetsSource() {
    if (!isTauriRuntime()) {
      addToast("Folder browsing is available in the TerraNova desktop app.", "warning");
      return;
    }
    const browseZip = hytaleCommonAssetsPath.trim().toLowerCase().endsWith(".zip")
      || activeHytaleSourcePath.trim().toLowerCase().endsWith(".zip");
    const selected = await openDialog(
      browseZip
        ? { directory: false, defaultPath: hytaleCommonAssetsPath || activeHytaleSourcePath, filters: [{ name: "Zip", extensions: ["zip"] }] }
        : { directory: true, defaultPath: hytaleCommonAssetsPath || activeHytaleSourcePath },
    );
    if (typeof selected === "string") setHytaleCommonAssetsPath(selected);
  }

  async function handleSyncHytaleAssets() {
    if (!isTauriRuntime()) {
      addToast("Hytale asset sync is available in the TerraNova desktop app.", "warning");
      return;
    }
    if (!hytaleAssetSyncEnabled) {
      addToast("Enable managed Hytale assets in Settings before syncing.", "warning");
      return;
    }
    if (!activeHytaleSourcePath.trim()) {
      addToast("Choose a Hytale asset source path first.", "warning");
      return;
    }
    try {
      // Start the sync in the background immediately. The Rust side will
      // emit a quick completion event if there are zero files to write, so
      // we avoid doing a potentially expensive pre-count on the UI thread.
      setSyncingHytaleAssets(true);

      const { result, cacheRoot, staleness } = await runHytaleAssetSync({
        sourcePath: activeHytaleSourcePath,
        commonOverlayEnabled: hytaleCommonAssetsEnabled,
        commonOverlayPath: hytaleCommonAssetsPath,
        channel: hytaleAssetSourceChannel,
      });
      setHytaleAssetCacheRoot(cacheRoot);
      setStalenessInfo(staleness);
      addToast(formatHytaleSyncToast(result), "success");
    } catch (error) {
      addToast(`Failed to sync Hytale assets: ${error}`, "error");
    } finally {
      setSyncingHytaleAssets(false);
    }
  }

  async function handleOpenHytaleAssetCache() {
    if (!hytaleAssetCacheRoot) return;
    if (!isTauriRuntime()) {
      addToast("Opening the asset cache is available in the TerraNova desktop app.", "warning");
      return;
    }
    try {
      await showInFolder(hytaleAssetCacheRoot);
    } catch (error) {
      addToast(`Could not open the Hytale asset cache: ${error}`, "error");
    }
  }

  function handleClearAssetBrowserCache() {
    clearAvailableHytaleAssetFoldersCache("hytale-assets");
    clearHytaleAssetsInFolderCache("hytale-assets");
    addToast("Cleared cached Hytale asset folder listings.", "success");
  }

  async function handleRefreshHardware() {
    if (!isTauriRuntime()) {
      addToast("Hardware detection is available in the TerraNova desktop app.", "warning");
      return;
    }
    try {
      setRefreshingHardware(true);
      clearHardwareDetectionCache();
      const info = await detectHardware();
      setHardwareInfo(info);
      addToast("Refreshed detected hardware information.", "success");
    } catch (error) {
      addToast(`Could not refresh hardware information: ${error}`, "error");
    } finally {
      setRefreshingHardware(false);
    }
  }

  // Categories are independent pages; carrying the previous scroll offset into
  // a new one lands the user mid-content for no reason.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [tab, searching]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  function handleNavigate(target: SettingDeepLink) {
    setQuery("");
    setTab(target.category);
  }

  const sidebarNav = (
    <CategoryRail active={tab} onSelect={setTab} developerMode={devActive} />
  );

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        title="Settings"
        layout="sidebar"
        // Fixed height: without it the panel resizes to each category's content,
        // so switching categories makes the whole dialog jump.
        widthClass="w-[1040px] max-w-[95vw] h-[680px]"
        sidebar={sidebarNav}
        bodyRef={bodyRef}
        footer={
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded border border-tn-border bg-tn-bg hover:bg-tn-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
          >
            Close
          </button>
        }
      >
        <div className="mb-4 flex items-center gap-2">
          <SettingsSearchInput value={query} onChange={setQuery} inputRef={searchInputRef} />
        </div>

        {searching ? (
          <SettingsSearchResults
            query={query}
            developerMode={devActive}
            onNavigate={handleNavigate}
          />
        ) : (
        <div
          role="tabpanel"
          id={`settings-panel-${tab}`}
          aria-labelledby={`settings-tab-${tab}`}
        >
            {tab === "general" && (
              <CategoryPanel category="general" developerMode={devActive} onNavigate={handleNavigate} />
            )}

            {tab === "editor" && (
              <CategoryPanel category="editor" developerMode={devActive} onNavigate={handleNavigate} />
            )}

            {tab === "files" && (
              <CategoryPanel category="files" developerMode={devActive} onNavigate={handleNavigate}>
                <FilesOperations />
              </CategoryPanel>
            )}

            {tab === "updates" && (
              <CategoryPanel category="updates" developerMode={devActive} onNavigate={handleNavigate}>
                <section aria-labelledby="settings-updates-actions" className="flex flex-col gap-2">
                  <h3 id="settings-updates-actions" className="text-sm font-medium text-tn-text">
                    Version
                  </h3>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-tn-border bg-tn-bg px-3 py-2">
                    <span className="text-sm text-tn-text-muted">
                      TerraNova {appVersion || "—"}
                    </span>
                    {updateStatus === "available" ? (
                      <button
                        type="button"
                        onClick={downloadAndInstall}
                        className="min-h-8 rounded border border-tn-accent px-3 text-sm text-tn-accent hover:bg-tn-accent/10"
                      >
                        Download {updateVersion}
                      </button>
                    ) : updateStatus === "downloading" ? (
                      <span className="text-sm text-amber-400">Downloading… {updateProgress}%</span>
                    ) : updateStatus === "restarting" ? (
                      <span className="text-sm text-amber-400">Restarting…</span>
                    ) : updateStatus === "ready" ? (
                      <button
                        type="button"
                        onClick={restartToUpdate}
                        className="min-h-8 rounded border border-emerald-400 px-3 text-sm text-emerald-400 hover:bg-emerald-400/10"
                      >
                        Restart to update
                      </button>
                    ) : updateStatus === "checking" ? (
                      <span className="text-sm text-tn-text-muted">Checking…</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => checkForUpdates(true)}
                        className="min-h-8 rounded border border-tn-border px-3 text-sm hover:bg-tn-surface"
                      >
                        Check now
                      </button>
                    )}
                  </div>
                </section>
              </CategoryPanel>
            )}

            {/* ── Assets ── */}
            {tab === "performance" && (
              <SystemSettingsPanel initialTab={initialSystemTab} />
            )}

            {tab === "shortcuts" && (
              <KeyboardShortcutsPanel />
            )}

            {tab === "account" && (
              <AccountSettingsPanel />
            )}

            {tab === "assets" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-tn-text-muted uppercase tracking-wider">Default Export Path</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={exportPath ?? "Not set"}
                      className="flex-1 px-3 py-1.5 rounded border border-tn-border bg-tn-bg text-sm text-tn-text-muted truncate"
                    />
                    <button onClick={handleBrowseExportPath} className="px-3 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface whitespace-nowrap">
                      Browse...
                    </button>
                    <button onClick={() => setExportPath(null)} className="px-3 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface text-tn-text-muted" disabled={!exportPath}>
                      Clear
                    </button>
                  </div>
                  <p className="text-xs text-tn-text-muted">Default target directory for File › Export operations</p>
                </div>

                <div className="border-t border-tn-border/50 pt-4 flex flex-col gap-3">
                  <label className="text-xs font-medium text-tn-text-muted uppercase tracking-wider">Hytale Asset Cache</label>

                  <button
                    onClick={() => setHytaleAssetSyncEnabled(!hytaleAssetSyncEnabled)}
                    className={`text-left px-3 py-2 rounded border text-sm ${
                      hytaleAssetSyncEnabled ? "border-tn-accent bg-tn-accent/10" : "border-tn-border bg-tn-bg hover:bg-tn-surface"
                    }`}
                  >
                    <span className="font-medium">Managed Hytale asset cache</span>
                    <span className="ml-2 text-[10px] font-medium text-tn-text-muted">{hytaleAssetSyncEnabled ? "On" : "Off"}</span>
                    <p className="mt-0.5 text-xs text-tn-text-muted">
                      Sync release or pre-release Hytale assets into TerraNova's local cache instead of shipping them with the app.
                    </p>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setHytaleAssetSourceChannel("pre-release")}
                      className={`text-left px-3 py-2 rounded border text-sm ${
                        hytaleAssetSourceChannel === "pre-release" ? "border-tn-accent bg-tn-accent/10" : "border-tn-border bg-tn-bg hover:bg-tn-surface"
                      }`}
                    >
                      <span className="font-medium">Pre-release</span>
                      <p className="mt-0.5 text-xs text-tn-text-muted">Read directly from `Assets.zip`.</p>
                    </button>
                    <button
                      onClick={() => setHytaleAssetSourceChannel("release")}
                      className={`text-left px-3 py-2 rounded border text-sm ${
                        hytaleAssetSourceChannel === "release" ? "border-tn-accent bg-tn-accent/10" : "border-tn-border bg-tn-bg hover:bg-tn-surface"
                      }`}
                    >
                      <span className="font-medium">Release</span>
                      <p className="mt-0.5 text-xs text-tn-text-muted">Use `Assets.zip` inside the release `latest` folder when present.</p>
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-tn-text-muted">
                      {hytaleAssetSourceChannel === "pre-release" ? "Pre-release asset source" : "Release asset source"}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={activeHytaleSourcePath}
                        onChange={(e) => setActiveHytaleSourcePath(e.target.value)}
                        className="flex-1 rounded border border-tn-border bg-tn-bg px-3 py-1.5 text-sm text-tn-text"
                      />
                      <button onClick={handleBrowseHytaleAssetSource} className="px-3 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface whitespace-nowrap">Browse...</button>
                      <button
                        onClick={() => {
                          if (!isTauriRuntime()) {
                            addToast("Default Hytale asset paths are available in the TerraNova desktop app.", "warning");
                            return;
                          }
                          const resolve = hytaleAssetSourceChannel === "pre-release"
                            ? resolveDefaultPreReleaseAssetsPath
                            : resolveDefaultReleaseAssetsPath;
                          void resolve().then(setActiveHytaleSourcePath).catch(() => setActiveHytaleSourcePath(""));
                        }}
                        className="px-3 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface text-tn-text-muted whitespace-nowrap"
                      >
                        Default
                      </button>
                    </div>
                    <p className="text-xs text-tn-text-muted">
                      Pre-release can point straight at `Assets.zip`. Release can point at the `latest` folder or a zip file inside it.
                    </p>
                  </div>

                  <button
                    onClick={() => setHytaleCommonAssetsEnabled(!hytaleCommonAssetsEnabled)}
                    className={`text-left px-3 py-2 rounded border text-sm ${
                      hytaleCommonAssetsEnabled ? "border-tn-accent bg-tn-accent/10" : "border-tn-border bg-tn-bg hover:bg-tn-surface"
                    }`}
                  >
                    <span className="font-medium">Include external Common assets</span>
                    <span className="ml-2 text-[10px] font-medium text-tn-text-muted">{hytaleCommonAssetsEnabled ? "On" : "Off"}</span>
                    <p className="mt-0.5 text-xs text-tn-text-muted">
                      Layer an extra `Common` source over the synced cache for block textures, material PNGs, sky art, and other TerraNova references.
                    </p>
                  </button>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-tn-text-muted">External Common asset source</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={hytaleCommonAssetsPath}
                        onChange={(e) => setHytaleCommonAssetsPath(e.target.value)}
                        disabled={!hytaleCommonAssetsEnabled}
                        className="flex-1 rounded border border-tn-border bg-tn-bg px-3 py-1.5 text-sm text-tn-text disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <button onClick={handleBrowseCommonAssetsSource} disabled={!hytaleCommonAssetsEnabled} className="px-3 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50">Browse...</button>
                      <button onClick={() => setHytaleCommonAssetsPath(activeHytaleSourcePath)} disabled={!hytaleCommonAssetsEnabled || !activeHytaleSourcePath.trim()} className="px-3 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface text-tn-text-muted whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50">Use Source</button>
                      <button
                        onClick={() => {
                          if (!isTauriRuntime()) {
                            addToast("Default Hytale asset paths are available in the TerraNova desktop app.", "warning");
                            return;
                          }
                          void resolveDefaultCommonAssetsPath().then(setHytaleCommonAssetsPath).catch(() => setHytaleCommonAssetsPath(""));
                        }}
                        disabled={!hytaleCommonAssetsEnabled}
                        className="px-3 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface text-tn-text-muted whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Default
                      </button>
                    </div>
                    <p className="text-xs text-tn-text-muted">
                      Point this at `Common` directly, a parent folder that contains `Common`, or an `Assets.zip` source. TerraNova will read the internal `Common/` subtree automatically.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-tn-text-muted">TerraNova cache folder</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={hytaleAssetCacheRoot || "Loading cache path..."}
                        className="flex-1 rounded border border-tn-border bg-tn-bg px-3 py-1.5 text-sm text-tn-text-muted"
                      />
                      <button onClick={() => { void handleOpenHytaleAssetCache(); }} className="px-3 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface whitespace-nowrap" disabled={!hytaleAssetCacheRoot}>
                        Open Cache
                      </button>
                      <button
                        onClick={() => { void handleSyncHytaleAssets(); }}
                        className="px-3 py-1.5 text-sm rounded border border-tn-accent text-tn-accent hover:bg-tn-accent/10 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={syncingHytaleAssets}
                      >
                        {syncingHytaleAssets ? "Syncing..." : "Sync Now"}
                      </button>
                    </div>
                  </div>

                  {activeHytaleSourcePath.trim() && (
                    <div className={`flex items-center gap-2 rounded border px-3 py-2 text-[11px] ${
                      checkingStaleness
                        ? "border-tn-border/50 text-tn-text-muted"
                        : (stalenessInfo?.channelMismatch || stalenessInfo?.isStale)
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                          : stalenessInfo?.syncedAt
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-tn-border/50 text-tn-text-muted"
                    }`}>
                      <span className="shrink-0 text-base leading-none">
                        {checkingStaleness ? "⏳" : (stalenessInfo?.channelMismatch || stalenessInfo?.isStale) ? "⚠️" : stalenessInfo?.syncedAt ? "✓" : "–"}
                      </span>
                      <span>
                        {checkingStaleness
                          ? "Checking source for updates…"
                          : stalenessInfo?.channelMismatch
                            ? <><span>Cache was built from a different channel — </span><button onClick={() => { void handleSyncHytaleAssets(); }} className="underline hover:no-underline">Re-sync to avoid conflicts</button></>
                            : stalenessInfo?.isStale
                              ? <><span>Source has files newer than your cache — </span><button onClick={() => { void handleSyncHytaleAssets(); }} className="underline hover:no-underline">Sync Now</button></>
                              : stalenessInfo?.syncedAt
                                ? `Cache is up to date · Last synced ${formatSyncedAt(stalenessInfo.syncedAt)}`
                                : "Not synced yet — press Sync Now to build the cache"}
                      </span>
                    </div>
                  )}

                  <div className="rounded border border-tn-border/60 bg-tn-bg/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted">Manual Setup</p>
                    <div className="mt-2 flex flex-col gap-2 text-[11px] leading-relaxed text-tn-text-muted">
                      <p>Point TerraNova at the asset source on your computer and press <span className="font-medium text-tn-text">Sync Now</span>.</p>
                      <p><span className="font-medium text-tn-text">Pre-release:</span> target the `Assets.zip` file directly.</p>
                      <p className="rounded border border-tn-border/40 bg-tn-panel/40 px-2 py-1 font-mono text-[10px] text-tn-text">
                        {examplePreReleasePath || "Resolving path…"}
                      </p>
                      <p><span className="font-medium text-tn-text">Release:</span> target the `latest` folder or its `Assets.zip`.</p>
                      <p className="rounded border border-tn-border/40 bg-tn-panel/40 px-2 py-1 font-mono text-[10px] text-tn-text">
                        {exampleReleasePath || "Resolving path…"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-950 px-3 py-2.5 text-[11px] text-amber-100">
                    <AlertTriangle className="shrink-0 mt-px h-4 w-4 text-amber-300" aria-hidden />
                    <p>
                      The Hytale asset cache can reach <span className="font-medium text-amber-200">2–4 GB</span> depending on which release channel you sync and whether Common assets are included.
                      Make sure the drive hosting your TerraNova folder has enough free space before syncing.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ── About ── */}
            {tab === "developer" && (
              <>
                <div className="rounded border border-tn-border/60 bg-tn-bg/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-tn-text">Developer Tools</p>
                      <p className="mt-1 text-xs text-tn-text-muted">Optional controls for debugging TerraNova locally. Safe to ignore for normal editing.</p>
                    </div>
                    <span className="rounded border border-tn-border/60 px-2 py-1 text-[10px] uppercase tracking-wider text-tn-text-muted">
                      Advanced
                    </span>
                  </div>
                </div>

                <SettingsNestedCard className="px-3 divide-y divide-tn-border/40">
                  <p className="text-xs font-medium text-tn-text-muted uppercase tracking-wider py-2">Mode</p>
                  <DevSettingRow
                    label="Developer mode"
                    description="Enables debug controls in production builds."
                    checked={developerMode}
                    onChange={setDeveloperMode}
                  />
                  {import.meta.env.DEV && (
                    <DevSettingRow
                      label="Auto-enable in dev builds"
                      description="Turn on developer tooling when running pnpm tauri dev."
                      checked={autoEnableDeveloperModeInDev}
                      onChange={setAutoEnableDeveloperModeInDev}
                    />
                  )}
                </SettingsNestedCard>

                {devActive && (
                  <p className="text-xs text-emerald-400/90 px-1">
                    Developer tooling is active{import.meta.env.DEV && !developerMode ? " (dev build)" : ""}.
                  </p>
                )}

                {!devActive ? (
                  <div className="rounded border border-tn-border/60 bg-tn-bg/60 px-3 py-2.5 text-xs text-tn-text-muted">
                    Enable developer mode to access logging, diagnostics, and the optional tools below.
                  </div>
                ) : (
                  <>
                    <SettingsNestedCard className="px-3 divide-y divide-tn-border/40">
                      <p className="text-xs font-medium text-tn-text-muted uppercase tracking-wider py-2">Tools</p>
                      <DevSettingRow
                        label="Verbose worker logging"
                        description="Log preview worker steps, import resolution, and layout changes to the console (off by default)."
                        checked={debugWorkerLogging}
                        onChange={setDebugWorkerLogging}
                      />
                      <DevSettingRow
                        label="Developer tools panel"
                        description="Bottom dock for store snapshots and export diff."
                        checked={showDevToolsDock}
                        onChange={setShowDevToolsDock}
                      />
                      <DevSettingRow
                        label="Preview timing overlay"
                        description="Live elapsed + last eval time for 2D, voxel, and world preview (developer mode)."
                        checked={showPerformanceOverlay}
                        onChange={setShowPerformanceOverlay}
                      />
                      <DevSettingRow
                        label="Node IDs on canvas"
                        description="Show UUIDs under nodes (pairs with the properties inspector)."
                        checked={showNodeIdsOnCanvas}
                        onChange={setShowNodeIdsOnCanvas}
                      />
                    </SettingsNestedCard>

                    <div className="rounded border border-tn-border bg-tn-bg p-3 flex flex-col gap-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-tn-text-muted">Session snapshot</p>
                        <p className="mt-1 text-xs text-tn-text-muted">
                          Copy project path, open file, graph counts, validation summary, preview state, and Bridge status as JSON for bug reports.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void buildBugReportBundle().then((snap) =>
                            copyTextToClipboard(formatBugReportClipboard(snap)).then((ok) => {
                              addToast(ok ? "Copied debug report" : "Could not copy debug report", ok ? "success" : "error");
                            }),
                          );
                        }}
                        className="self-start px-3 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface"
                      >
                        Copy session snapshot
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <div className="rounded border border-tn-border/60 bg-tn-bg/60 p-3 flex flex-col gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-tn-text-muted">Caches</p>
                          <p className="mt-1 text-xs text-tn-text-muted">Use these when asset browsing or hardware detection needs a clean refresh.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleClearAssetBrowserCache}
                            className="px-3 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface"
                          >
                            Clear Asset Browser Cache
                          </button>
                          <button
                            onClick={() => { clearHardwareDetectionCache(); setHardwareInfo(null); addToast("Cleared cached hardware detection.", "success"); }}
                            className="px-3 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface"
                          >
                            Clear Hardware Cache
                          </button>
                        </div>
                      </div>

                      <div className="rounded border border-tn-border/60 bg-tn-bg/60 p-3 flex flex-col gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-tn-text-muted">Detected Hardware</p>
                          <p className="mt-1 text-xs text-tn-text-muted">Quick reference for the live hardware profile TerraNova is currently using.</p>
                        </div>
                        <div className="text-xs text-tn-text-muted flex flex-col gap-1">
                          <p><span className="text-tn-text">CPU:</span> {hardwareInfo?.cpuName || "Unknown"}</p>
                          <p><span className="text-tn-text">Cores:</span> {hardwareInfo?.cpuCores ?? "Unknown"}</p>
                          <p><span className="text-tn-text">GPU:</span> {hardwareInfo?.gpuRenderer || "Unknown"}</p>
                          <p><span className="text-tn-text">Adapters:</span> {hardwareInfo?.gpus.length ?? 0}</p>
                          <p><span className="text-tn-text">RAM:</span> {hardwareInfo?.totalRamMb ? `${(hardwareInfo.totalRamMb / 1024).toFixed(1)} GB` : "Unknown"}</p>
                        </div>
                        <button
                          onClick={() => { void handleRefreshHardware(); }}
                          disabled={refreshingHardware}
                          className="self-start px-3 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {refreshingHardware ? "Refreshing..." : "Refresh Hardware Info"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {tab === "about" && (
              <>
                {/* App identity */}
                <div className="rounded border border-tn-border/60 bg-tn-bg/60 p-4 flex flex-col gap-1">
                  <p className="text-sm font-semibold text-tn-text">TerraNova</p>
                  <p className="text-[11px] text-tn-text-muted">Offline design studio for Hytale World Generation V2</p>
                  <p className="mt-1 text-[11px] text-tn-text-muted">v{appVersion}</p>
                </div>

                {/* Authors */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-tn-text-muted uppercase tracking-wider">Author</label>
                  <div className="flex flex-col gap-1.5">
                    <div className="rounded border border-tn-border/60 bg-tn-bg/60 px-3 py-2.5 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-tn-text">McCal</span>
                        <span className="text-[10px] rounded border border-tn-border/50 px-1.5 py-0.5 text-tn-text-muted">McCal-Codes</span>
                      </div>
                      <p className="text-[11px] text-tn-text-muted leading-relaxed">
                        TerraNova — Hytale worldgen editor, preview, atmosphere stack, Bridge integration, and McCal-Codes closed alpha.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Contributors */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-tn-text-muted uppercase tracking-wider">Contributors</label>
                  <p className="text-[11px] text-tn-text-muted leading-relaxed">
                    McCal-Codes, nmang004, ZenithDevHQ, LeoWherle, derrickmehaffy — see{" "}
                    <a
                      href="https://github.com/McCal-Codes/TerraNova/graphs/contributors"
                      className="text-tn-accent hover:opacity-80"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      GitHub contributors
                    </a>
                    .
                  </p>
                </div>

                {/* Legal */}
                <div className="border-t border-tn-border/50 pt-4 flex flex-col gap-2">
                  <label className="text-xs font-medium text-tn-text-muted uppercase tracking-wider">Legal</label>
                  <div className="rounded border border-tn-border/60 bg-tn-bg/60 px-3 py-2.5 flex flex-col gap-1 text-[11px] text-tn-text-muted">
                    <p>© 2024–2026 McCal.</p>
                    <p>TerraNova is not affiliated with or endorsed by Hypixel Studios.</p>
                    <p>Hytale is a trademark of Hypixel Studios.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLegalDialog("license")}
                      className="flex-1 px-3 py-2 rounded border border-tn-border bg-tn-bg hover:bg-tn-surface text-sm text-left"
                    >
                      <span className="font-medium text-tn-text">License</span>
                      <p className="text-xs mt-0.5 text-tn-text-muted">GNU Lesser General Public License v2.1</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLegalDialog("notice")}
                      className="flex-1 px-3 py-2 rounded border border-tn-border bg-tn-bg hover:bg-tn-surface text-sm text-left"
                    >
                      <span className="font-medium text-tn-text">Copyright Notices</span>
                      <p className="text-xs mt-0.5 text-tn-text-muted">Third-party acknowledgements</p>
                    </button>
                  </div>
                </div>

                {/* Support */}
                <div className="border-t border-tn-border/50 pt-4 flex flex-col gap-2">
                  <label className="text-xs font-medium text-tn-text-muted uppercase tracking-wider">Support</label>
                  <button
                    type="button"
                    onClick={() => useBugReportStore.getState().requestOpen()}
                    className="text-left px-3 py-2 rounded border border-tn-border bg-tn-bg hover:bg-tn-surface text-sm"
                  >
                    <span className="font-medium">Report a bug</span>
                    <p className="text-xs text-tn-text-muted mt-0.5">Copy a debug bundle and open the GitHub issue form</p>
                  </button>
                </div>

                {/* Release notes */}
                <div className="border-t border-tn-border/50 pt-4 flex flex-col gap-2">
                  <label className="text-xs font-medium text-tn-text-muted uppercase tracking-wider">Release Notes</label>
                  <div className="flex gap-2">
                    <button onClick={() => setShowWhatsNew(true)} className="flex-1 px-3 py-2 rounded border border-tn-border bg-tn-bg hover:bg-tn-surface text-sm">
                      View What's New
                    </button>
                    <button onClick={() => setShowChangelog(true)} className="flex-1 px-3 py-2 rounded border border-tn-border bg-tn-bg hover:bg-tn-surface text-sm">
                      All Changelogs
                    </button>
                  </div>
                  {onOpenAlphaChecklist && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAlphaChecklist();
                      }}
                      className="text-left px-3 py-2 rounded border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-sm w-full"
                    >
                      <span className="font-medium text-tn-text">View What to test checklist</span>
                      <p className="text-xs text-tn-text-muted mt-0.5">Closed-alpha tester focus areas for this build</p>
                    </button>
                  )}
                </div>
              </>
            )}

        </div>
        )}
      </ModalShell>
      <WhatsNewDialog
        open={showWhatsNew}
        onClose={(suppress) => {
          void markWhatsNewSeen(suppress);
          // Writes straight to whatsNewPrefs, which is what the
          // general.showWhatsNewOnStartup setting reads from.
          if (suppress) setWhatsNewSuppressed(true);
          setShowWhatsNew(false);
        }}
      />
      <ChangelogDialog open={showChangelog} onClose={() => setShowChangelog(false)} />
      <LegalTextDialog
        open={legalDialog === "license"}
        onClose={() => setLegalDialog(null)}
        title="License"
        body={licenseText}
      />
      <LegalTextDialog
        open={legalDialog === "notice"}
        onClose={() => setLegalDialog(null)}
        title="Copyright Notices"
        body={noticeText}
      />
    </>
  );
}
