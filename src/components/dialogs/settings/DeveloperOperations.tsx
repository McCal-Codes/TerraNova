import { useEffect, useState } from "react";
import { focusRing } from "@/components/ui/settingsPrimitives";
import { buildBugReportBundle, formatBugReportClipboard } from "@/utils/bugReport";
import { copyTextToClipboard } from "@/utils/devTools";
import { clearAvailableHytaleAssetFoldersCache } from "@/utils/hytaleAssetFolders";
import { clearHytaleAssetsInFolderCache } from "@/utils/getHytaleAssetsInFolder";
import { clearHardwareDetectionCache, detectHardware, type HardwareInfo } from "@/utils/hardwareDetect";
import { isTauriRuntime } from "@/utils/platform";
import { useToastStore } from "@/stores/toastStore";

/**
 * Developer *operations*, split from the preferences above them.
 *
 * Copying a snapshot, clearing caches and re-detecting hardware are commands.
 * Refreshing hardware in particular was presented as if it were a setting; it
 * is a diagnostic action and reads as one here.
 */

const actionButton = `min-h-8 rounded border border-tn-border bg-tn-bg px-3 text-sm hover:bg-tn-surface disabled:cursor-not-allowed disabled:opacity-50`;

export function DeveloperOperations() {
  const addToast = useToastStore((s) => s.addToast);
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void detectHardware().then(setHardware).catch(() => setHardware(null));
  }, []);

  async function handleRefreshHardware() {
    if (!isTauriRuntime()) {
      addToast("Hardware detection is available in the TerraNova desktop app.", "warning");
      return;
    }
    try {
      setRefreshing(true);
      clearHardwareDetectionCache();
      setHardware(await detectHardware());
      addToast("Refreshed detected hardware information.", "success");
    } catch (error) {
      addToast(`Could not refresh hardware information: ${error}`, "error");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="dev-snapshot" className="flex flex-col gap-2">
        <h3 id="dev-snapshot" className="text-sm font-medium text-tn-text">Session snapshot</h3>
        <p className="text-xs text-tn-text-muted">
          Copies project path, open file, graph counts, validation summary, preview state and Bridge
          status as JSON, for a bug report.
        </p>
        <button
          type="button"
          onClick={() => {
            void buildBugReportBundle().then((snap) =>
              copyTextToClipboard(formatBugReportClipboard(snap)).then((ok) =>
                addToast(
                  ok ? "Copied debug report" : "Could not copy debug report",
                  ok ? "success" : "error",
                ),
              ),
            );
          }}
          className={`self-start ${actionButton} ${focusRing}`}
        >
          Copy session snapshot
        </button>
      </section>

      <section aria-labelledby="dev-caches" className="flex flex-col gap-2">
        <h3 id="dev-caches" className="text-sm font-medium text-tn-text">Caches</h3>
        <p className="text-xs text-tn-text-muted">
          Use when asset browsing or hardware detection needs a clean refresh.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              clearAvailableHytaleAssetFoldersCache("hytale-assets");
              clearHytaleAssetsInFolderCache("hytale-assets");
              addToast("Cleared cached Hytale asset folder listings.", "success");
            }}
            className={`${actionButton} ${focusRing}`}
          >
            Clear asset browser cache
          </button>
          <button
            type="button"
            onClick={() => {
              clearHardwareDetectionCache();
              setHardware(null);
              addToast("Cleared cached hardware detection.", "success");
            }}
            className={`${actionButton} ${focusRing}`}
          >
            Clear hardware cache
          </button>
        </div>
      </section>

      <section aria-labelledby="dev-hardware" className="flex flex-col gap-2">
        <h3 id="dev-hardware" className="text-sm font-medium text-tn-text">Detected hardware</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-tn-text-muted">
          <dt className="text-tn-text">CPU</dt><dd>{hardware?.cpuName || "Unknown"}</dd>
          <dt className="text-tn-text">Cores</dt><dd>{hardware?.cpuCores ?? "Unknown"}</dd>
          <dt className="text-tn-text">GPU</dt><dd>{hardware?.gpuRenderer || "Unknown"}</dd>
          <dt className="text-tn-text">Adapters</dt><dd>{hardware?.gpus.length ?? 0}</dd>
          <dt className="text-tn-text">RAM</dt>
          <dd>{hardware?.totalRamMb ? `${(hardware.totalRamMb / 1024).toFixed(1)} GB` : "Unknown"}</dd>
        </dl>
        <button
          type="button"
          onClick={() => void handleRefreshHardware()}
          disabled={refreshing}
          className={`self-start ${actionButton} ${focusRing}`}
        >
          {refreshing ? "Refreshing…" : "Refresh hardware info"}
        </button>
      </section>
    </div>
  );
}
