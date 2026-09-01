import { useState } from "react";
import { focusRing } from "@/components/ui/settingsPrimitives";
import { backupPackDirectory, showInFolder } from "@/utils/ipc";
import { isTauriRuntime } from "@/utils/platform";
import {
  CLOSED_ALPHA_PACK_BACKUP_ENABLED,
  clearAllPackBackupSkips,
  formatPackBackupTimestamp,
  formatPackPathLabel,
  suggestPackBackupPath,
} from "@/utils/alphaPackBackup";
import { useProjectStore } from "@/stores/projectStore";
import { useRecentProjectsStore } from "@/stores/recentProjectsStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";

const actionButton = (extra = "") =>
  `min-h-8 rounded border border-tn-border bg-tn-bg px-3 text-sm hover:bg-tn-surface disabled:cursor-not-allowed disabled:opacity-40 ${focusRing} ${extra}`;

/**
 * Operations that used to sit inside the Settings body. These are commands, not
 * preferences — Settings configures backup behaviour, this panel performs it.
 */
export function FilesOperations() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const packBackupParentFolder = useSettingsStore((s) => s.packBackupParentFolder);
  const recentProjects = useRecentProjectsStore((s) => s.projects);
  const clearRecentProjects = useRecentProjectsStore((s) => s.clearAll);
  const addToast = useToastStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);

  async function handleBackupCurrentProject() {
    if (!projectPath?.trim()) {
      addToast("Open a project first to back up its pack folder.", "warning");
      return;
    }
    if (!isTauriRuntime()) {
      addToast("Pack backup is available in the TerraNova desktop app.", "warning");
      return;
    }
    setBusy(true);
    try {
      const parent = packBackupParentFolder.trim() || undefined;
      const destination = suggestPackBackupPath(projectPath, formatPackBackupTimestamp(), parent);
      const result = await backupPackDirectory(projectPath, destination);
      addToast(`Pack backed up (${result.filesCopied} files)`, "success", {
        label: "Show backup",
        onClick: () => {
          void showInFolder(result.backupPath);
        },
      });
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBusy(false);
    }
  }

  function handleClearPackBackupSkips() {
    const removed = clearAllPackBackupSkips();
    addToast(
      removed > 0
        ? `Cleared ${removed} pack skip flag${removed === 1 ? "" : "s"}`
        : "No skip flags to clear",
      removed > 0 ? "success" : "info",
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {CLOSED_ALPHA_PACK_BACKUP_ENABLED ? (
        <section aria-labelledby="settings-files-backup-actions" className="flex flex-col gap-2">
          <h3 id="settings-files-backup-actions" className="text-sm font-medium text-tn-text">
            Backup actions
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleBackupCurrentProject()}
              disabled={!projectPath || busy}
              className={actionButton()}
            >
              {busy ? "Backing up…" : "Back up open project now"}
            </button>
            <button
              type="button"
              onClick={handleClearPackBackupSkips}
              className={actionButton("text-tn-text-muted")}
            >
              Reset “don’t ask again” list
            </button>
          </div>
          {projectPath ? (
            <p className="truncate font-mono text-[11px] text-tn-text-muted">
              Open pack: {formatPackPathLabel(projectPath)}
            </p>
          ) : (
            <p className="text-[11px] text-tn-text-muted">No project is open.</p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="settings-files-recent" className="flex flex-col gap-2">
        <h3 id="settings-files-recent" className="text-sm font-medium text-tn-text">
          Recent projects
        </h3>
        <div className="flex items-center justify-between gap-3 rounded border border-tn-border bg-tn-bg px-3 py-2">
          <span className="text-sm text-tn-text-muted">
            {recentProjects.length} project{recentProjects.length === 1 ? "" : "s"} in history
          </span>
          <button
            type="button"
            onClick={() => {
              clearRecentProjects();
              addToast("Recent projects cleared", "success");
            }}
            disabled={recentProjects.length === 0}
            className={actionButton()}
          >
            Clear history
          </button>
        </div>
      </section>
    </div>
  );
}
