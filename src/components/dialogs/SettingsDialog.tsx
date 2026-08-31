import { useEffect, useRef, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { SettingsNestedCard } from "@/components/ui/settingsPrimitives";
import { CATEGORY_META, type CategoryId, type SettingDeepLink } from "@/settings/registry";
import "@/settings/index";
import { CategoryRail } from "./settings/CategoryRail";
import { CategoryPanel } from "./settings/CategoryPanel";
import { FilesOperations } from "./settings/FilesOperations";
import { HytaleAssetsPanel } from "./settings/HytaleAssetsPanel";
import { SettingsSearchInput, SettingsSearchResults } from "./settings/SettingsSearch";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUpdateStore } from "@/stores/updateStore";
import { checkForUpdates, downloadAndInstall, restartToUpdate } from "@/utils/updater";
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


export function SettingsDialog({ open, onClose, initialTab = "general", initialSystemTab = "cpu", onOpenAlphaChecklist }: SettingsDialogProps) {
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

  // Developer → Caches keeps its own entry point; Hytale assets has an
  // equivalent "Repair cache" beside the sync controls it belongs with.
  function handleClearAssetBrowserCache() {
    clearAvailableHytaleAssetFoldersCache("hytale-assets");
    clearHytaleAssetsInFolderCache("hytale-assets");
    addToast("Cleared cached Hytale asset folder listings.", "success");
  }
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
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [refreshingHardware, setRefreshingHardware] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) {
      setAppVersion("browser preview");
      return;
    }

    void getAppVersion().then(setAppVersion).catch(() => setAppVersion(""));
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab(resolveTab(initialTab));
    setQuery("");
  }, [open, initialTab]);

  
  useEffect(() => {
    if (!open || (tab !== "performance" && tab !== "developer")) return;
    void detectHardware()
      .then(setHardwareInfo)
      .catch(() => setHardwareInfo(null));
  }, [open, tab]);







  






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
              <CategoryPanel category="assets" developerMode={devActive} onNavigate={handleNavigate}>
                <HytaleAssetsPanel />
              </CategoryPanel>
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
