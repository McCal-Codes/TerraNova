/**
 * Startup behaviour, stored outside the settings store so session restore can
 * read it during boot without pulling the store in.
 */

const RESTORE_LAST_PROJECT_KEY = "tn-restore-last-project";

/**
 * Off by default: opening straight into the previously loaded pack evaluates a
 * potentially large project before the user has asked for anything, and leaves
 * no way back to Home if that project is what fails to load.
 */
export function getRestoreLastProject(): boolean {
  try {
    return localStorage.getItem(RESTORE_LAST_PROJECT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setRestoreLastProject(value: boolean): void {
  try {
    if (value) localStorage.setItem(RESTORE_LAST_PROJECT_KEY, "1");
    else localStorage.removeItem(RESTORE_LAST_PROJECT_KEY);
  } catch {
    // Storage unavailable — the default (open to Home) still applies.
  }
}

const AUTO_RECOVER_WEBVIEW_KEY = "tn-auto-recover-webview";

/**
 * Whether the Rust watchdog may reload a webview that stops responding.
 * Defaults on; see src-tauri/src/webview_watchdog.rs.
 */
export function getAutoRecoverWebview(): boolean {
  try {
    return localStorage.getItem(AUTO_RECOVER_WEBVIEW_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAutoRecoverWebview(value: boolean): void {
  try {
    if (value) localStorage.removeItem(AUTO_RECOVER_WEBVIEW_KEY);
    else localStorage.setItem(AUTO_RECOVER_WEBVIEW_KEY, "0");
  } catch {
    // ignore
  }
  // Push it to the watchdog, which holds its own copy.
  void import("@/utils/webviewHeartbeat").then((m) => m.setWebviewAutoRecover(value));
}
