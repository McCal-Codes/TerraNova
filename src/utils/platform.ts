export const isMac = navigator.userAgent.includes("Mac");

/** Platform-aware shortcut label for UI hints (Ctrl on Windows/Linux, ⌘ on macOS). */
export function formatShortcut(shortcut: string): string {
  if (isMac) {
    return shortcut
      .replace(/Ctrl\+/gi, "⌘")
      .replace(/Alt\+/gi, "⌥")
      .replace(/Shift\+/gi, "⇧");
  }
  return shortcut.replace(/Meta\+/gi, "Ctrl+");
}

export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}
