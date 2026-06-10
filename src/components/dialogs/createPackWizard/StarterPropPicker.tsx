import { useState } from "react";
import { usePrefabPathCatalog } from "@/hooks/usePrefabPathCatalog";
import { PrefabPickerPanel } from "@/components/preview/PrefabPickerPanel";
import { WizardField } from "./WizardField";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import { runHytaleAssetSync, formatHytaleSyncToast } from "@/utils/hytaleAssetSyncAction";
import { isTauriRuntime } from "@/utils/platform";

interface StarterPropPickerProps {
  value: string;
  onChange: (path: string) => void;
}

export function StarterPropPicker({ value, onChange }: StarterPropPickerProps) {
  const catalog = usePrefabPathCatalog(null);
  const hytaleReleaseAssetsPath = useSettingsStore((s) => s.hytaleReleaseAssetsPath);
  const hytaleCommonAssetsEnabled = useSettingsStore((s) => s.hytaleCommonAssetsEnabled);
  const hytaleCommonAssetsPath = useSettingsStore((s) => s.hytaleCommonAssetsPath);
  const hytaleAssetSyncEnabled = useSettingsStore((s) => s.hytaleAssetSyncEnabled);
  const addToast = useToastStore((s) => s.addToast);
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    if (!hytaleAssetSyncEnabled) {
      addToast("Enable managed Hytale assets in Settings before syncing.", "warning");
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

  return (
    <WizardField
      label="Starter prop prefab"
      description={
        catalog.loading
          ? "Loading prefab paths from synced Hytale assets…"
          : "Optional prefab added to Props on launch. Filter by folder, pick from the list, preview updates live."
      }
    >
      <PrefabPickerPanel
        value={value}
        onChange={onChange}
        catalog={catalog}
        catalogLoading={catalog.loading}
        onRequestSync={() => void handleSync()}
        syncInProgress={syncing}
      />
      {catalog.truncated && (
        <p className="text-[11px] text-tn-text-muted mt-1">
          Catalog truncated — filter to find more paths.
        </p>
      )}
    </WizardField>
  );
}
