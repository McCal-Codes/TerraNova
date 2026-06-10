import { useEffect, useMemo, useState } from "react";
import { usePrefabPathCatalog } from "@/hooks/usePrefabPathCatalog";
import { usePrefabPreview } from "@/hooks/usePrefabPreview";
import { PrefabPreview3D } from "@/components/preview/PrefabPreview3D";
import { WizardField, wizardInputClass, wizardSelectClass } from "./WizardField";
import { STARTER_PREFAB_SUGGESTIONS } from "@/constants/starterPrefabSuggestions";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import { runHytaleAssetSync, formatHytaleSyncToast } from "@/utils/hytaleAssetSyncAction";
import { isTauriRuntime } from "@/utils/platform";
import {
  filterPrefabPaths,
  formatPrefabOptionLabel,
  listPrefabCategories,
  listPrefabSubcategories,
  PREFAB_BROWSE_MIN_QUERY,
} from "@/utils/hytaleBlockAssets/prefabCatalogFilters";

const SELECT_LIMIT = 200;

interface StarterPropPickerProps {
  value: string;
  onChange: (path: string) => void;
}

type PickMode = "none" | "suggested" | "browse" | "custom";

function resolveInitialMode(path: string): PickMode {
  if (!path.trim()) return "none";
  if (STARTER_PREFAB_SUGGESTIONS.some((s) => s.path === path)) return "suggested";
  return "browse";
}

export function StarterPropPicker({ value, onChange }: StarterPropPickerProps) {
  const catalog = usePrefabPathCatalog(null);
  const hytaleReleaseAssetsPath = useSettingsStore((s) => s.hytaleReleaseAssetsPath);
  const hytaleCommonAssetsEnabled = useSettingsStore((s) => s.hytaleCommonAssetsEnabled);
  const hytaleCommonAssetsPath = useSettingsStore((s) => s.hytaleCommonAssetsPath);
  const hytaleAssetSyncEnabled = useSettingsStore((s) => s.hytaleAssetSyncEnabled);
  const addToast = useToastStore((s) => s.addToast);
  const [syncing, setSyncing] = useState(false);
  const [mode, setMode] = useState<PickMode>(() => resolveInitialMode(value));
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [suggestedId, setSuggestedId] = useState(
    () => STARTER_PREFAB_SUGGESTIONS.find((s) => s.path === value)?.id ?? "",
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  const categories = useMemo(() => listPrefabCategories(catalog.paths), [catalog.paths]);
  const subcategories = useMemo(
    () => (category ? listPrefabSubcategories(catalog.paths, category) : []),
    [catalog.paths, category],
  );

  const browseMatches = useMemo(() => {
    if (!category) return [];
    let paths = filterPrefabPaths(catalog.paths, { category, query: debouncedQuery });
    if (subcategory) {
      const prefix = `${category}/${subcategory}`;
      paths = paths.filter((p) => p.startsWith(`${prefix}/`) || p === prefix);
    }
    if (value && !paths.includes(value)) {
      paths = [value, ...paths];
    }
    return paths.slice(0, SELECT_LIMIT);
  }, [catalog.paths, category, subcategory, debouncedQuery, value]);

  const browseReady =
    Boolean(category)
    && (debouncedQuery.trim().length >= PREFAB_BROWSE_MIN_QUERY || Boolean(subcategory));

  const previewFields = useMemo(() => ({ Path: value }), [value]);
  const preview = usePrefabPreview(previewFields, null, 350);

  const emptyCatalog = !catalog.loading && !catalog.error && catalog.paths.length === 0;

  function handleModeChange(next: PickMode) {
    setMode(next);
    if (next === "none") {
      onChange("");
      setSuggestedId("");
      return;
    }
    if (next === "custom") return;
    if (next === "suggested" && suggestedId) {
      const pick = STARTER_PREFAB_SUGGESTIONS.find((s) => s.id === suggestedId);
      if (pick) onChange(pick.path);
    }
  }

  function handleSuggestedChange(id: string) {
    setSuggestedId(id);
    const pick = STARTER_PREFAB_SUGGESTIONS.find((s) => s.id === id);
    if (pick) onChange(pick.path);
  }

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
      description="Optional prefab appended to Props on launch. Pick a quick suggestion or browse by category."
    >
      <div className="flex flex-col gap-3">
        <select
          value={mode}
          onChange={(e) => handleModeChange(e.target.value as PickMode)}
          className={wizardSelectClass}
        >
          <option value="none">None — skip custom prefab</option>
          <option value="suggested">Quick pick (recommended)</option>
          <option value="browse">Browse catalog…</option>
          <option value="custom">Custom path</option>
        </select>

        {mode === "suggested" && (
          <div className="space-y-1.5">
            <select
              value={suggestedId}
              onChange={(e) => handleSuggestedChange(e.target.value)}
              className={wizardSelectClass}
            >
              <option value="">Choose a starter…</option>
              {STARTER_PREFAB_SUGGESTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {suggestedId && (
              <p className="text-[11px] text-tn-text-muted">
                {STARTER_PREFAB_SUGGESTIONS.find((s) => s.id === suggestedId)?.hint}
              </p>
            )}
          </div>
        )}

        {mode === "browse" && (
          <div className="rounded border border-tn-border/70 bg-tn-bg/30 p-3 space-y-2">
            {emptyCatalog && (
              <div className="text-xs text-tn-text-muted space-y-2">
                <p>Sync Hytale release assets to browse prefabs (onboarding Step 3 or Settings → Assets).</p>
                {isTauriRuntime() && (
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={() => void handleSync()}
                    className="px-3 py-1 text-xs rounded border border-tn-accent/40 text-tn-accent hover:bg-tn-accent/10 disabled:opacity-50"
                  >
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                )}
              </div>
            )}

            {!emptyCatalog && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-tn-text-muted">Category</span>
                    <select
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setSubcategory("");
                      }}
                      className={wizardSelectClass}
                    >
                      <option value="">Choose category…</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  {subcategories.length > 0 && (
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-tn-text-muted">Subfolder</span>
                      <select
                        value={subcategory}
                        onChange={(e) => setSubcategory(e.target.value)}
                        className={wizardSelectClass}
                      >
                        <option value="">All in category</option>
                        {subcategories.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    category
                      ? `Search within ${category} (min ${PREFAB_BROWSE_MIN_QUERY} chars)…`
                      : "Pick a category first"
                  }
                  disabled={!category}
                  className={wizardInputClass}
                />

                {!category && (
                  <p className="text-[11px] text-tn-text-muted">
                    Large categories like Blocksets have thousands of entries — choose a category before searching.
                  </p>
                )}

                {category && !browseReady && (
                  <p className="text-[11px] text-tn-text-muted">
                    Select a subfolder or type at least {PREFAB_BROWSE_MIN_QUERY} characters to list prefabs.
                  </p>
                )}

                {browseReady && (
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-tn-text-muted">
                      Prefab
                      {browseMatches.length > 0 && (
                        <span className="normal-case text-tn-text-muted/80">
                          {" "}
                          · {browseMatches.length}
                          {browseMatches.length >= SELECT_LIMIT ? "+" : ""} shown
                        </span>
                      )}
                    </span>
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className={wizardSelectClass}
                      size={Math.min(8, Math.max(3, browseMatches.length))}
                    >
                      <option value="">Select prefab…</option>
                      {browseMatches.map((path) => (
                        <option key={path} value={path}>
                          {formatPrefabOptionLabel(path, category)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}

            {catalog.error && (
              <p className="text-[11px] text-amber-400/90">{catalog.error}</p>
            )}
          </div>
        )}

        {mode === "custom" && (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Trees/Palm_Green/Stage_2"
            className={wizardInputClass}
          />
        )}

        {value.trim() && (
          <div className="rounded border border-tn-border/60 overflow-hidden bg-[#1c1a17]">
            <div className="px-2.5 py-1.5 border-b border-tn-border/40 bg-tn-panel/80">
              <p className="text-[10px] font-mono text-tn-text truncate" title={value}>
                {value}
              </p>
              <p className="text-[10px] text-tn-text-muted">
                {preview.mesh
                  ? `${preview.mesh.blockCount.toLocaleString()} blocks · drag preview to orbit`
                  : preview.loading
                    ? "Loading preview…"
                    : "Preview unavailable — path may still export if valid in-game"}
              </p>
            </div>
            <div className="relative h-[160px]">
              {preview.mesh && !preview.loading && (
                <PrefabPreview3D mesh={preview.mesh} className="absolute inset-0 w-full h-full" compact />
              )}
            </div>
          </div>
        )}
      </div>
    </WizardField>
  );
}
