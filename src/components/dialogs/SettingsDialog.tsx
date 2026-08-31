import { useEffect, useRef, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { CATEGORY_META, type CategoryId, type SettingDeepLink } from "@/settings/registry";
import "@/settings/index";
import { CategoryRail } from "./settings/CategoryRail";
import { CategoryPanel } from "./settings/CategoryPanel";
import { FilesOperations } from "./settings/FilesOperations";
import { DeveloperOperations } from "./settings/DeveloperOperations";
import { HytaleAssetsPanel } from "./settings/HytaleAssetsPanel";
import { SettingsSearchInput, SettingsSearchResults } from "./settings/SettingsSearch";
import { useUpdateStore } from "@/stores/updateStore";
import { checkForUpdates, downloadAndInstall, restartToUpdate } from "@/utils/updater";
import { useBugReportStore } from "@/stores/bugReportStore";
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
import { isTauriRuntime } from "@/utils/platform";
import { getAppVersion } from "@/utils/fetchReleases";
import { useDeveloperMode } from "@/hooks/useDeveloperMode";

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
  const devActive = useDeveloperMode();

  // Developer → Caches keeps its own entry point; Hytale assets has an
  // equivalent "Repair cache" beside the sync controls it belongs with.

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
              <CategoryPanel category="developer" developerMode={devActive} onNavigate={handleNavigate}>
                {devActive ? (
                  <DeveloperOperations />
                ) : (
                  <p className="rounded border border-tn-border/60 bg-tn-bg/60 px-3 py-2.5 text-xs text-tn-text-muted">
                    Turn on developer mode to access logging, diagnostics and the tools below.
                  </p>
                )}
              </CategoryPanel>
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
