import { useSettingsStore } from "@/stores/settingsStore";

/** True when Settings → Developer → Verbose worker logging is enabled. */
export function isPreviewWorkerLoggingEnabled(): boolean {
  try {
    return useSettingsStore.getState().debugWorkerLogging;
  } catch {
    return false;
  }
}

export function previewWorkerLog(scope: string, ...args: unknown[]): void {
  if (!isPreviewWorkerLoggingEnabled()) return;
  console.log(`[preview:${scope}]`, ...args);
}

/** Warnings only when verbose logging is on (keeps the console clean by default). */
export function previewWorkerWarn(scope: string, ...args: unknown[]): void {
  if (!isPreviewWorkerLoggingEnabled()) return;
  console.warn(`[preview:${scope}]`, ...args);
}

export function previewWorkerLogFromWorker(
  scope: string,
  level: "log" | "warn",
  message: string,
  data?: unknown,
): void {
  const payload = data !== undefined ? [message, data] : [message];
  if (level === "warn") {
    previewWorkerWarn(`${scope}:worker`, ...payload);
    return;
  }
  previewWorkerLog(`${scope}:worker`, ...payload);
}
