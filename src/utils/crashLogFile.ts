import { appLogDir, join } from "@tauri-apps/api/path";
import { createDirectory, writeTextFile } from "@/utils/ipc";
import { isTauriRuntime } from "@/utils/platform";
import type { PersistedCrash } from "@/components/ErrorBoundary";

/**
 * Crash log on disk, so a force quit still leaves evidence.
 *
 * localStorage is the wrong place for this on its own: WebKit buffers writes
 * through a WAL, a hard kill can lose the most recent entries, and reading it
 * back requires devtools or digging through
 * ~/Library/WebKit/<id>/WebsiteData/.../localstorage.sqlite3.
 *
 * This writes to appLogDir(), which Tauri resolves to ~/Library/Logs/<app> on
 * macOS — the platform-standard location. Console.app picks it up, `log show`
 * can be pointed at it, and it survives the process dying because it is written
 * at the moment of the crash rather than at exit.
 */

const LOG_FILE = "crash.log";

/** Keep the file bounded; a crash loop must not fill the disk. */
const MAX_ENTRIES = 50;

let cachedPath: string | null = null;

/** ~/Library/Logs/<app>/crash.log on macOS; the OS equivalent elsewhere. */
export async function crashLogPath(): Promise<string> {
  if (cachedPath) return cachedPath;
  const dir = await appLogDir();
  cachedPath = await join(dir, LOG_FILE);
  return cachedPath;
}

function formatEntry(crash: PersistedCrash, appVersion: string): string {
  const lines = [
    "─".repeat(72),
    `${crash.at}  TerraNova ${appVersion}  ${navigator.platform}`,
    `url: ${crash.url}`,
    "",
    crash.message,
  ];
  if (crash.componentStack) lines.push("", "component stack:", crash.componentStack.trim());
  if (crash.stack) lines.push("", "stack:", crash.stack.trim());
  lines.push("");
  return lines.join("\n");
}

/**
 * Appends a crash entry. Best-effort and never throws — a diagnostic must not
 * become a second failure on top of the one it is reporting.
 *
 * `history` is the in-memory crash list, newest first; it is rewritten whole
 * rather than appended to, because the IPC layer exposes a whole-file write and
 * the file is intentionally small.
 */
export async function writeCrashLogFile(
  history: PersistedCrash[],
  appVersion = "unknown",
): Promise<void> {
  if (!isTauriRuntime() || history.length === 0) return;
  try {
    const dir = await appLogDir();
    await createDirectory(dir).catch(() => {});
    const path = await join(dir, LOG_FILE);
    const body = history
      .slice(0, MAX_ENTRIES)
      .map((entry) => formatEntry(entry, appVersion))
      .join("\n");
    await writeTextFile(
      path,
      `TerraNova crash log — newest first\n${body}`,
    );
  } catch {
    // Disk full, permissions, or the command not being available in this build.
    // The in-memory and localStorage copies still exist.
  }
}
