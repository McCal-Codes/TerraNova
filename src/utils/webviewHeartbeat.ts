import { isTauriRuntime } from "@/utils/platform";

/**
 * Tells the Rust watchdog the UI is still alive.
 *
 * See `src-tauri/src/webview_watchdog.rs`: when the WKWebView content process
 * dies the window blanks and no JavaScript runs at all, so the *absence* of
 * this ping is the only signal available. Silence past the watchdog's threshold
 * triggers a reload.
 */

/** Comfortably under the watchdog's 20s threshold, so a slow tick is harmless. */
const PING_INTERVAL_MS = 3_000;

let timer: ReturnType<typeof setInterval> | null = null;

export function startWebviewHeartbeat(): void {
  if (!isTauriRuntime() || timer !== null) return;

  const ping = () => {
    void import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke("ui_heartbeat"))
      .catch(() => {
        // An older build without the command, or IPC briefly unavailable.
        // Failing loudly here would spam the console once per tick.
      });
  };

  ping();
  timer = setInterval(ping, PING_INTERVAL_MS);
}

export function stopWebviewHeartbeat(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/** Mirrors the `developer.autoRecoverWebview` setting into the watchdog. */
export async function setWebviewAutoRecover(enabled: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_webview_auto_recover", { enabled });
  } catch {
    // Setting is best-effort; the default (enabled) still applies.
  }
}
