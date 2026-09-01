import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { focusRing } from "@/components/ui/settingsPrimitives";
import { clearAvailableHytaleAssetFoldersCache } from "@/utils/hytaleAssetFolders";
import { clearHytaleAssetsInFolderCache } from "@/utils/getHytaleAssetsInFolder";
import { formatHytaleSyncToast, runHytaleAssetSync } from "@/utils/hytaleAssetSyncAction";
import {
  checkHytaleAssetStaleness,
  getHytaleAssetCacheRoot,
  showInFolder,
  type AssetStalenessInfo,
} from "@/utils/ipc";
import {
  resolveDefaultPreReleaseAssetsPath,
  resolveDefaultReleaseAssetsPath,
} from "@/utils/hytaleDefaultPaths";
import { isTauriRuntime } from "@/utils/platform";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";

/**
 * Hytale asset *operations*, split out of Settings.
 *
 * Syncing, opening and repairing the cache are commands, not preferences —
 * Settings configures which source is used, this performs the work. Keeping
 * them together is what made the Settings dialog a mixture of configuration
 * and actions in the first place.
 */

function formatSyncedAt(syncedAt: string): string {
  const secs = Date.parse(syncedAt) / 1000;
  if (Number.isNaN(secs)) return syncedAt;
  const diff = Math.floor(Date.now() / 1000 - secs);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

const actionButton = (extra = "") =>
  `min-h-8 whitespace-nowrap rounded border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${extra}`;

export function HytaleAssetsPanel() {
  const channel = useSettingsStore((s) => s.hytaleAssetSourceChannel);
  const releasePath = useSettingsStore((s) => s.hytaleReleaseAssetsPath);
  const preReleasePath = useSettingsStore((s) => s.hytalePreReleaseAssetsPath);
  const syncEnabled = useSettingsStore((s) => s.hytaleAssetSyncEnabled);
  const commonEnabled = useSettingsStore((s) => s.hytaleCommonAssetsEnabled);
  const commonPath = useSettingsStore((s) => s.hytaleCommonAssetsPath);
  const addToast = useToastStore((s) => s.addToast);

  const sourcePath = channel === "pre-release" ? preReleasePath : releasePath;

  const [cacheRoot, setCacheRoot] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [staleness, setStaleness] = useState<AssetStalenessInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [examplePreRelease, setExamplePreRelease] = useState("");
  const [exampleRelease, setExampleRelease] = useState("");

  useEffect(() => {
    void getHytaleAssetCacheRoot().then(setCacheRoot).catch(() => setCacheRoot(""));
    if (!isTauriRuntime()) return;
    void resolveDefaultPreReleaseAssetsPath().then(setExamplePreRelease).catch(() => {});
    void resolveDefaultReleaseAssetsPath().then(setExampleRelease).catch(() => {});
  }, []);

  useEffect(() => {
    if (!sourcePath.trim()) return;
    setChecking(true);
    void checkHytaleAssetStaleness(sourcePath, channel)
      .then(setStaleness)
      .catch(() => setStaleness(null))
      .finally(() => setChecking(false));
  }, [sourcePath, channel]);

  async function handleSync() {
    if (!isTauriRuntime()) {
      addToast("Hytale asset sync is available in the TerraNova desktop app.", "warning");
      return;
    }
    if (!syncEnabled) {
      addToast("Turn on “Check for stale assets automatically” before syncing.", "warning");
      return;
    }
    if (!sourcePath.trim()) {
      addToast("Choose a Hytale asset source path first.", "warning");
      return;
    }
    try {
      setSyncing(true);
      const result = await runHytaleAssetSync({
        sourcePath,
        commonOverlayEnabled: commonEnabled,
        commonOverlayPath: commonPath,
        channel,
      });
      setCacheRoot(result.cacheRoot);
      setStaleness(result.staleness);
      addToast(formatHytaleSyncToast(result.result), "success");
    } catch (error) {
      addToast(`Failed to sync Hytale assets: ${error}`, "error");
    } finally {
      setSyncing(false);
    }
  }

  async function handleOpenCache() {
    if (!cacheRoot) return;
    if (!isTauriRuntime()) {
      addToast("Opening the asset cache is available in the TerraNova desktop app.", "warning");
      return;
    }
    try {
      await showInFolder(cacheRoot);
    } catch (error) {
      addToast(`Could not open the Hytale asset cache: ${error}`, "error");
    }
  }

  function handleClearBrowserCache() {
    clearAvailableHytaleAssetFoldersCache("hytale-assets");
    clearHytaleAssetsInFolderCache("hytale-assets");
    addToast("Cleared cached Hytale asset folder listings.", "success");
  }

  const stale = staleness?.channelMismatch || staleness?.isStale;

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="assets-cache" className="flex flex-col gap-2">
        <h3 id="assets-cache" className="text-sm font-medium text-tn-text">
          Asset cache
        </h3>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            aria-label="TerraNova cache folder"
            value={cacheRoot || "Loading cache path…"}
            className="min-h-8 flex-1 truncate rounded border border-tn-border bg-tn-bg px-2 font-mono text-[11px] text-tn-text-muted"
          />
          <button
            type="button"
            onClick={() => void handleOpenCache()}
            disabled={!cacheRoot}
            className={actionButton("border-tn-border bg-tn-bg hover:bg-tn-surface")}
          >
            Open cache
          </button>
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            className={actionButton("border-tn-accent text-tn-accent hover:bg-tn-accent/10")}
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>

        {sourcePath.trim() ? (
          // Status is conveyed by its text, not only the colour of the border.
          <p
            aria-live="polite"
            className={`rounded border px-3 py-2 text-[11px] ${
              checking
                ? "border-tn-border/50 text-tn-text-muted"
                : stale
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : staleness?.syncedAt
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-tn-border/50 text-tn-text-muted"
            }`}
          >
            {checking
              ? "Checking source for updates…"
              : staleness?.channelMismatch
                ? "Cache was built from a different channel — re-sync to avoid conflicts."
                : staleness?.isStale
                  ? "Source has files newer than your cache — sync to update it."
                  : staleness?.syncedAt
                    ? `Cache is up to date · last synced ${formatSyncedAt(staleness.syncedAt)}`
                    : "Not synced yet — press Sync now to build the cache."}
          </p>
        ) : (
          <p className="text-[11px] text-tn-text-muted">
            Set an asset source above, then sync.
          </p>
        )}

        <div>
          <button
            type="button"
            onClick={handleClearBrowserCache}
            className={actionButton("border-tn-border bg-tn-bg text-tn-text-muted hover:bg-tn-surface")}
          >
            Repair cache
          </button>
          <p className="mt-1 text-[11px] text-tn-text-muted">
            Clears cached folder listings. Use when the asset browser shows stale or missing folders.
          </p>
        </div>
      </section>

      <section aria-labelledby="assets-manual" className="flex flex-col gap-2">
        <h3 id="assets-manual" className="text-sm font-medium text-tn-text">
          Where to point it
        </h3>
        <div className="flex flex-col gap-2 rounded border border-tn-border/60 bg-tn-bg/60 p-3 text-[11px] leading-relaxed text-tn-text-muted">
          <p>
            <span className="font-medium text-tn-text">Pre-release:</span> target the `Assets.zip`
            file directly.
          </p>
          <p className="rounded border border-tn-border/40 bg-tn-panel/40 px-2 py-1 font-mono text-[10px] text-tn-text">
            {examplePreRelease || "Resolving path…"}
          </p>
          <p>
            <span className="font-medium text-tn-text">Release:</span> target the `latest` folder or
            its `Assets.zip`.
          </p>
          <p className="rounded border border-tn-border/40 bg-tn-panel/40 px-2 py-1 font-mono text-[10px] text-tn-text">
            {exampleRelease || "Resolving path…"}
          </p>
        </div>

        <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-950 px-3 py-2.5 text-[11px] text-amber-100">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          <p>
            The Hytale asset cache can reach{" "}
            <span className="font-medium text-amber-200">2–4 GB</span> depending on the channel and
            whether Common assets are included. Check the drive hosting your TerraNova folder has
            room before syncing.
          </p>
        </div>
      </section>
    </div>
  );
}
