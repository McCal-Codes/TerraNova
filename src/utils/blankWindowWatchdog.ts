import { readCrashLog } from "@/components/ErrorBoundary";

/**
 * Last-resort diagnostics for a blank window.
 *
 * React's error boundary covers render errors, but an error thrown before the
 * root mounts — or one that leaves the tree unmounted — produces an empty page
 * with no explanation. In the Tauri shell there is no easily reachable console,
 * so "it just goes blank" is all the user can report.
 *
 * This checks whether anything actually rendered and, if not, paints a plain
 * DOM panel (deliberately no React, no imports that could themselves fail)
 * showing the most recent recorded crash.
 */

const WATCHDOG_DELAY_MS = 8_000;
const PANEL_ID = "tn-blank-watchdog";

function rootLooksEmpty(root: HTMLElement): boolean {
  if (root.childElementCount === 0) return true;
  // A root containing only empty wrappers still reads as blank to the user.
  return root.textContent?.trim().length === 0;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderPanel(root: HTMLElement): void {
  if (document.getElementById(PANEL_ID)) return;

  const crash = readCrashLog()[0];
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.setAttribute("role", "alert");
  panel.style.cssText = [
    "position:fixed", "inset:0", "z-index:2147483647",
    "overflow:auto", "padding:24px",
    "background:#14161c", "color:#e6e8ee",
    "font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace",
  ].join(";");

  const detail = crash
    ? `<p style="margin:0 0 4px"><strong>${escapeHtml(crash.message)}</strong></p>
       <p style="margin:0 0 12px;opacity:.7">Recorded ${escapeHtml(crash.at)}</p>
       <pre style="white-space:pre-wrap;word-break:break-all;opacity:.85;margin:0">${escapeHtml(
         [crash.componentStack, crash.stack].filter(Boolean).join("\n\n"),
       )}</pre>`
    : `<p style="margin:0;opacity:.8">No crash was recorded, so the interface stalled rather than
       threw. Check the dev server output, and the console if devtools are available.</p>`;

  panel.innerHTML = `
    <h1 style="margin:0 0 8px;font-size:15px">TerraNova did not finish loading</h1>
    <p style="margin:0 0 16px;opacity:.7">
      The window is empty ${WATCHDOG_DELAY_MS / 1000}s after startup. Details below —
      include them in a bug report.
    </p>
    ${detail}
    <p style="margin:16px 0 0;opacity:.6">
      Crash history is kept in localStorage under <code>tn-crash-log</code>.
    </p>`;

  root.appendChild(panel);
}

export function installBlankWindowWatchdog(): void {
  window.setTimeout(() => {
    try {
      const root = document.getElementById("root");
      if (root && rootLooksEmpty(root)) renderPanel(root);
    } catch {
      // A diagnostic must never be the thing that breaks startup.
    }
  }, WATCHDOG_DELAY_MS);
}
