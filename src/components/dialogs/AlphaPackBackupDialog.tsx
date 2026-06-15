import { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ALPHA_WHAT_TO_TEST_VERSION,
} from "@/constants/alphaTestFocus";
import { usePackBackupStore } from "@/stores/packBackupStore";
import { useToastStore } from "@/stores/toastStore";
import {
  formatPackPathLabel,
  isHytaleSaveModPackPath,
  markPackBackupSkipped,
  suggestPackBackupPath,
  getDefaultPackBackupParent,
} from "@/utils/alphaPackBackup";
import { backupPackDirectory, showInFolder } from "@/utils/ipc";

/** Closed-alpha backup prompt before opening an existing pack. */
export function AlphaPackBackupDialog() {
  const openDialog = usePackBackupStore((s) => s.open);
  const pending = usePackBackupStore((s) => s.pending);
  const complete = usePackBackupStore((s) => s.complete);

  const [customDestination, setCustomDestination] = useState<string | null>(null);
  const [skipFuture, setSkipFuture] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const packPath = pending?.packPath ?? "";
  const defaultBackupPath = useMemo(
    () => (packPath ? suggestPackBackupPath(packPath, undefined, getDefaultPackBackupParent()) : ""),
    [packPath],
  );
  const backupPreview = customDestination ?? defaultBackupPath;
  const saveMod = packPath ? isHytaleSaveModPackPath(packPath) : false;

  if (!openDialog || !pending) return null;

  function handleCancel() {
    if (busy) return;
    setCustomDestination(null);
    setSkipFuture(false);
    setError(null);
    complete({ action: "cancel" });
  }

  function handleOpenWithoutBackup() {
    if (busy) return;
    if (skipFuture) markPackBackupSkipped(packPath);
    setCustomDestination(null);
    setSkipFuture(false);
    setError(null);
    complete({ action: "open", backedUp: false });
  }

  async function handleBackupAndOpen() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const destination = customDestination ?? suggestPackBackupPath(packPath, undefined, getDefaultPackBackupParent());
      const result = await backupPackDirectory(packPath, destination);
      if (skipFuture) markPackBackupSkipped(packPath);
      useToastStore.getState().addToast(
        `Pack backed up (${result.filesCopied} files)`,
        "success",
        {
          label: "Show backup",
          onClick: () => {
            void showInFolder(result.backupPath);
          },
        },
      );
      setCustomDestination(null);
      setSkipFuture(false);
      complete({ action: "open", backedUp: true, backupPath: result.backupPath });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleChooseFolder() {
    const selected = (await open({
      directory: true,
      title: "Choose where to store the backup",
      defaultPath: packPath.replace(/[/\\][^/\\]+$/, ""),
    })) as string | null;
    if (!selected) return;
    const path = selected;
    setCustomDestination(suggestPackBackupPath(packPath, undefined, path));
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4"
      onClick={handleCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alpha-pack-backup-title"
        className="w-full max-w-lg rounded-lg border border-amber-500/30 bg-tn-panel shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-tn-border shrink-0 bg-amber-500/5">
          <p className="text-[10px] uppercase tracking-wider text-amber-400/90 mb-1">
            Closed alpha · {ALPHA_WHAT_TO_TEST_VERSION}
          </p>
          <h2 id="alpha-pack-backup-title" className="text-base font-semibold text-tn-text">
            Back up pack before opening?
          </h2>
          <p className="text-xs text-tn-text-muted mt-1 leading-relaxed">
            TerraNova alpha may change pack files on disk. Create a full folder copy before
            editing{saveMod ? " — especially for live Hytale save mods" : ""}.
          </p>
        </header>

        <div className="px-5 py-4 space-y-3 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-tn-text-muted mb-1">Pack</p>
            <p className="font-mono text-[11px] text-tn-text break-all">{formatPackPathLabel(packPath)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-tn-text-muted mb-1">Backup folder</p>
            <p className="font-mono text-[11px] text-tn-text break-all">{formatPackPathLabel(backupPreview)}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleChooseFolder()}
              className="mt-2 text-tn-accent hover:underline disabled:opacity-50"
            >
              Choose a different folder…
            </button>
          </div>
          {error && (
            <p className="text-amber-300/90 leading-relaxed" role="alert">
              {error}
            </p>
          )}
          <label className="flex items-start gap-2 text-tn-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={skipFuture}
              onChange={(e) => setSkipFuture(e.target.checked)}
              disabled={busy}
              className="mt-0.5"
            />
            <span>Don&apos;t ask again for this pack</span>
          </label>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 border-t border-tn-border shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="px-3 py-1.5 text-xs rounded border border-tn-border hover:bg-tn-surface disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOpenWithoutBackup}
            disabled={busy}
            className="px-3 py-1.5 text-xs rounded border border-tn-border hover:bg-tn-surface disabled:opacity-50"
          >
            Open without backup
          </button>
          <button
            type="button"
            onClick={() => void handleBackupAndOpen()}
            disabled={busy}
            className="px-4 py-1.5 text-xs rounded bg-tn-accent text-tn-bg font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Backing up…" : "Back up & open"}
          </button>
        </footer>
      </div>
    </div>
  );
}
