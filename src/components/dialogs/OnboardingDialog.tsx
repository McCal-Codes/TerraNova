import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useConfigStore } from "@/stores/configStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useToastStore } from "@/stores/toastStore";
import { resolveDefaultReleaseAssetsPath } from "@/utils/hytaleDefaultPaths";
import { pathExists } from "@/utils/ipc";
import { formatHytaleSyncToast, runHytaleAssetSync } from "@/utils/hytaleAssetSyncAction";
import { isTauriRuntime } from "@/utils/platform";
import type { HomeLearnSlug } from "@/components/home/HomeLearnDialog";

const STORAGE_KEY = "terranova:onboarding-v1";

export function isOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingComplete(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}

interface OnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenCreatePack?: () => void;
  onOpenSettings?: () => void;
  onOpenLearn?: (slug: HomeLearnSlug) => void;
}

type StepId = "welcome" | "preview" | "assets" | "done";

export function OnboardingDialog({
  open,
  onClose,
  onOpenCreatePack,
  onOpenSettings,
  onOpenLearn,
}: OnboardingDialogProps) {
  const [step, setStep] = useState<StepId>("welcome");
  const [syncing, setSyncing] = useState(false);
  const debounceMs = useConfigStore((s) => s.debounceMs);
  const setDebounceMs = useConfigStore((s) => s.setDebounceMs);
  const gpuBudget = useConfigStore((s) => s.gpuMemoryBudgetMb);
  const autoRefresh = usePreviewStore((s) => s.autoRefresh);
  const applyGpuBudget = useConfigStore((s) => s.applyGpuBudget);
  const setAutoRefresh = usePreviewStore((s) => s.setAutoRefresh);
  const hytaleSyncEnabled = useSettingsStore((s) => s.hytaleAssetSyncEnabled);
  const setHytaleSyncEnabled = useSettingsStore((s) => s.setHytaleAssetSyncEnabled);
  const setHytaleAssetSourceChannel = useSettingsStore((s) => s.setHytaleAssetSourceChannel);
  const hytaleReleaseAssetsPath = useSettingsStore((s) => s.hytaleReleaseAssetsPath);
  const setHytaleReleaseAssetsPath = useSettingsStore((s) => s.setHytaleReleaseAssetsPath);
  const hytaleCommonAssetsEnabled = useSettingsStore((s) => s.hytaleCommonAssetsEnabled);
  const hytaleCommonAssetsPath = useSettingsStore((s) => s.hytaleCommonAssetsPath);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (!open || step !== "assets") return;
    setHytaleAssetSourceChannel("release");
    if (hytaleReleaseAssetsPath.trim()) return;
    void resolveDefaultReleaseAssetsPath().then(async (path) => {
      if (!path) return;
      try {
        if (await pathExists(path)) setHytaleReleaseAssetsPath(path);
      } catch {
        // ignore
      }
    });
  }, [open, step, hytaleReleaseAssetsPath, setHytaleAssetSourceChannel, setHytaleReleaseAssetsPath]);

  if (!open) return null;

  function finish() {
    markOnboardingComplete();
    onClose();
  }

  async function handleBrowseSource() {
    if (!isTauriRuntime()) {
      addToast("Folder browsing is available in the TerraNova desktop app.", "warning");
      return;
    }
    const selected = await openDialog({
      directory: true,
      defaultPath: hytaleReleaseAssetsPath || undefined,
    });
    if (typeof selected === "string") setHytaleReleaseAssetsPath(selected);
  }

  async function handleSyncNow() {
    if (!hytaleSyncEnabled) {
      addToast("Enable Hytale asset sync below first.", "warning");
      return;
    }
    if (!isTauriRuntime()) {
      addToast("Hytale asset sync is available in the TerraNova desktop app.", "warning");
      return;
    }
    try {
      setSyncing(true);
      const { result } = await runHytaleAssetSync({
        sourcePath: hytaleReleaseAssetsPath,
        commonOverlayEnabled: hytaleCommonAssetsEnabled,
        commonOverlayPath: hytaleCommonAssetsPath,
      });
      addToast(formatHytaleSyncToast(result), "success");
    } catch (err) {
      addToast(`Failed to sync Hytale assets: ${err}`, "error");
    } finally {
      setSyncing(false);
    }
  }

  const steps: StepId[] = ["welcome", "preview", "assets", "done"];
  const stepIndex = steps.indexOf(step);
  const pathReady = hytaleReleaseAssetsPath.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-full max-w-lg rounded-lg border border-tn-border bg-tn-panel shadow-xl"
      >
        <header className="px-5 pt-5 pb-3 border-b border-tn-border/80">
          <p className="text-[10px] uppercase tracking-wider text-tn-text-muted mb-1">
            Step {stepIndex + 1} of {steps.length}
          </p>
          <h2 id="onboarding-title" className="text-lg font-medium text-tn-text">
            {step === "welcome" && "Welcome to TerraNova"}
            {step === "preview" && "Preview performance"}
            {step === "assets" && "Hytale assets"}
            {step === "done" && "You are set"}
          </h2>
        </header>

        <div className="px-5 py-4 space-y-4 text-sm text-tn-text-muted leading-relaxed">
          {step === "welcome" && (
            <p>
              TerraNova edits Hytale worldgen graphs with live 2D, 3D, and voxel previews.
              Use <strong className="text-tn-text font-normal">Create Pack</strong> on the home screen
              to scaffold a mod, or open an existing project.
            </p>
          )}

          {step === "preview" && (
            <>
              <p>These defaults keep previews responsive on most machines. You can change them anytime in Settings → System.</p>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-tn-text">Live preview delay ({debounceMs} ms)</span>
                <input
                  type="range"
                  min={150}
                  max={1200}
                  step={50}
                  value={debounceMs}
                  onChange={(e) => setDebounceMs(Number(e.target.value))}
                  className="w-full accent-tn-accent"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-tn-text">GPU memory budget ({gpuBudget} MB)</span>
                <input
                  type="range"
                  min={512}
                  max={8192}
                  step={256}
                  value={gpuBudget}
                  onChange={(e) => applyGpuBudget(Number(e.target.value))}
                  className="w-full accent-tn-accent"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-tn-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="accent-tn-accent"
                />
                Auto-refresh preview while editing
              </label>
            </>
          )}

          {step === "assets" && (
            <>
              <p>
                Block icons, prefab previews, and import validation use synced Hytale <strong className="text-tn-text font-normal">release</strong> assets.
              </p>
              <label className="flex items-center gap-2 text-xs text-tn-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={hytaleSyncEnabled}
                  onChange={(e) => setHytaleSyncEnabled(e.target.checked)}
                  className="accent-tn-accent"
                />
                Enable managed Hytale asset sync
              </label>
              <div className="rounded border border-tn-border/60 bg-tn-bg/50 px-3 py-2 space-y-2">
                <p className="text-[11px] text-tn-text-muted">
                  Source: {pathReady ? (
                    <span className="font-mono text-tn-text break-all">{hytaleReleaseAssetsPath}</span>
                  ) : (
                    <span className="text-amber-400/90">Not set — browse to your release install or Assets.zip</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleBrowseSource()}
                    className="px-3 py-1 text-xs rounded border border-tn-border hover:bg-tn-surface"
                  >
                    Browse
                  </button>
                  <button
                    type="button"
                    disabled={!hytaleSyncEnabled || !pathReady || syncing}
                    onClick={() => void handleSyncNow()}
                    className="px-3 py-1 text-xs rounded bg-tn-accent text-tn-bg font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                </div>
                <p className="text-[10px] text-tn-text-muted">
                  Progress appears in the sync dialog. You can continue without syncing and sync later in Settings.
                </p>
              </div>
            </>
          )}

          {step === "done" && (
            <>
              <p>
                Open a project, try the preview panel (2D → 3D → Voxel), and use Bridge when testing in-game.
                Full docs open with <strong className="text-tn-text font-normal">F1</strong> after you open a project.
              </p>
              {onOpenLearn && (
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenLearn("walkthroughs/quickstart")}
                    className="text-left px-3 py-2 text-xs rounded border border-tn-border hover:bg-tn-surface text-tn-text"
                  >
                    Read: Build your first pack
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenLearn("walkthroughs/create-a-world")}
                    className="text-left px-3 py-2 text-xs rounded border border-tn-border hover:bg-tn-surface text-tn-text"
                  >
                    Read: Create a world
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenLearn("walkthroughs/terrain-and-caves")}
                    className="text-left px-3 py-2 text-xs rounded border border-tn-border hover:bg-tn-surface text-tn-text"
                  >
                    Read: Terrain and caves
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-t border-tn-border/80">
          <button
            type="button"
            onClick={finish}
            className="text-xs text-tn-text-muted hover:text-tn-text"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step === "assets" && onOpenSettings && (
              <button
                type="button"
                onClick={() => onOpenSettings()}
                className="px-3 py-1.5 text-xs rounded border border-tn-border hover:bg-tn-surface"
              >
                Open Settings
              </button>
            )}
            {step === "done" && onOpenCreatePack && (
              <button
                type="button"
                onClick={() => {
                  finish();
                  onOpenCreatePack();
                }}
                className="px-3 py-1.5 text-xs rounded border border-tn-accent/40 bg-tn-accent/15 text-tn-accent hover:bg-tn-accent/25"
              >
                Create Pack
              </button>
            )}
            {step !== "done" ? (
              <button
                type="button"
                onClick={() => setStep(steps[stepIndex + 1]!)}
                className="px-4 py-1.5 text-xs rounded bg-tn-accent text-tn-bg font-medium hover:opacity-90"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                className="px-4 py-1.5 text-xs rounded bg-tn-accent text-tn-bg font-medium hover:opacity-90"
              >
                Get started
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
