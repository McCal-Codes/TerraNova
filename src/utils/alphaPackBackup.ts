import { BUILD_CHANNEL } from "@/utils/bugReport";
import { pathExists } from "@/utils/ipc";
import { resolveBridgeSaveContextFromPath } from "@/utils/resolveBridgeSaveContext";
import { sanitizeReportPath } from "@/utils/bugReport";
import { isTauriRuntime } from "@/utils/platform";
import { useSettingsStore } from "@/stores/settingsStore";

/** Gate pack-backup prompts to closed-alpha builds. */
export const CLOSED_ALPHA_PACK_BACKUP_ENABLED = BUILD_CHANNEL === "closed-alpha";

const SKIP_PREFIX = "terranova:alpha-pack-backup-skip:";

function normalizePackKey(packPath: string): string {
  return packPath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export function packBackupSkipStorageKey(packPath: string): string {
  return `${SKIP_PREFIX}${normalizePackKey(packPath)}`;
}

export function isPackBackupSkipped(packPath: string): boolean {
  try {
    return localStorage.getItem(packBackupSkipStorageKey(packPath)) === "1";
  } catch {
    return false;
  }
}

export function markPackBackupSkipped(packPath: string): void {
  try {
    localStorage.setItem(packBackupSkipStorageKey(packPath), "1");
  } catch {
    // ignore
  }
}

/** Clear all per-pack "don't ask again" flags (Settings → Pack backup). */
export function clearAllPackBackupSkips(): number {
  let removed = 0;
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(SKIP_PREFIX)) {
        localStorage.removeItem(key);
        removed += 1;
      }
    }
  } catch {
    // ignore
  }
  return removed;
}

export function getDefaultPackBackupParent(): string | undefined {
  const folder = useSettingsStore.getState().packBackupParentFolder.trim();
  return folder || undefined;
}

export function isHytaleSaveModPackPath(packPath: string): boolean {
  return resolveBridgeSaveContextFromPath(packPath) !== null;
}

export function formatPackBackupTimestamp(date = new Date()): string {
  return String(date.getTime());
}

/** Default backup folder shown in the alpha dialog (matches Rust layout). */
export function suggestPackBackupPath(
  packPath: string,
  stamp = formatPackBackupTimestamp(),
  backupParent?: string,
): string {
  const trimmed = packPath.replace(/[/\\]+$/, "");
  const sep = trimmed.includes("\\") ? "\\" : "/";
  const parts = trimmed.split(/[/\\]/).filter(Boolean);
  const packName = parts[parts.length - 1] ?? "pack";
  const parent = backupParent?.replace(/[/\\]+$/, "") ?? parts.slice(0, -1).join(sep);
  const backupRoot = backupParent
    ? parent
    : `${parent}${sep}.terranova-backups`;
  return `${backupRoot}${sep}${packName}-${stamp}`;
}

export function formatPackPathLabel(packPath: string): string {
  return sanitizeReportPath(packPath) ?? packPath;
}

export async function shouldPromptPackBackup(packPath: string): Promise<boolean> {
  if (!CLOSED_ALPHA_PACK_BACKUP_ENABLED || !isTauriRuntime()) return false;
  if (!useSettingsStore.getState().packBackupPromptEnabled) return false;
  if (!packPath.trim()) return false;
  if (isPackBackupSkipped(packPath)) return false;

  const hasManifest = await pathExists(joinPackPath(packPath, "manifest.json"));
  const hasServer = await pathExists(joinPackPath(packPath, "Server"));
  return hasManifest || hasServer;
}

function joinPackPath(packPath: string, child: string): string {
  const sep = packPath.includes("\\") ? "\\" : "/";
  return `${packPath.replace(/[/\\]+$/, "")}${sep}${child}`;
}
