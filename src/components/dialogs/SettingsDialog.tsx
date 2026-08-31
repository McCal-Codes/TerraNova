import { useEffect, useRef, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { CATEGORY_META, type CategoryId, type SettingDeepLink } from "@/settings/registry";
import "@/settings/index";
import { CategoryRail } from "./settings/CategoryRail";
import { CategoryPanel } from "./settings/CategoryPanel";
import { FilesOperations } from "./settings/FilesOperations";
import { AboutPanel } from "./settings/AboutPanel";
import { DeveloperOperations } from "./settings/DeveloperOperations";
import { HytaleAssetsPanel } from "./settings/HytaleAssetsPanel";
import { SettingsSearchInput, SettingsSearchResults } from "./settings/SettingsSearch";
import { useUpdateStore } from "@/stores/updateStore";
import { checkForUpdates, downloadAndInstall, restartToUpdate } from "@/utils/updater";
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
              <AboutPanel
                appVersion={appVersion}
                onShowLegal={setLegalDialog}
                onShowWhatsNew={() => setShowWhatsNew(true)}
                onShowChangelog={() => setShowChangelog(true)}
                onOpenAlphaChecklist={
                  onOpenAlphaChecklist
                    ? () => {
                        onClose();
                        onOpenAlphaChecklist();
                      }
                    : undefined
                }
              />
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
