import { useEffect, useMemo, useState } from "react";
import { usePrefabPreview } from "@/hooks/usePrefabPreview";
import { PrefabPreview3D } from "@/components/preview/PrefabPreview3D";
import type { HytalePrefabPathCatalog } from "@/utils/hytaleBlockAssets/listHytalePrefabPaths";
import {
  PREFAB_CATEGORY_ALL,
  filterPrefabPaths,
  listPrefabCategories,
  shortPrefabLeaf,
} from "@/utils/hytaleBlockAssets/prefabCatalogFilters";
import { isTauriRuntime } from "@/utils/platform";

const DISPLAY_LIMIT = 400;

interface PrefabPickerPanelProps {
  value: string;
  onChange: (path: string) => void;
  catalog: HytalePrefabPathCatalog;
  catalogLoading?: boolean;
  onRequestSync?: () => void;
  syncInProgress?: boolean;
}

export function PrefabPickerPanel({
  value,
  onChange,
  catalog,
  catalogLoading = false,
  onRequestSync,
  syncInProgress = false,
}: PrefabPickerPanelProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState(PREFAB_CATEGORY_ALL);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  const categories = useMemo(() => listPrefabCategories(catalog.paths), [catalog.paths]);

  const filtered = useMemo(() => {
    let paths = filterPrefabPaths(catalog.paths, {
      query: debouncedQuery,
      category,
    });
    if (value && !paths.includes(value)) {
      paths = [value, ...paths];
    }
    return paths;
  }, [catalog.paths, debouncedQuery, category, value]);

  const visible = filtered.slice(0, DISPLAY_LIMIT);
  const hiddenCount = Math.max(0, filtered.length - visible.length);

  const previewFields = useMemo(() => ({ Path: value }), [value]);
  const preview = usePrefabPreview(previewFields, null, 350);

  const emptyCatalog = !catalogLoading && !catalog.error && catalog.paths.length === 0;

  return (
    <div className="flex flex-col gap-2 min-h-0">
      <div className="flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prefabs…"
            className="flex-1 px-2 py-1.5 text-xs rounded border border-tn-border bg-tn-bg text-tn-text placeholder:text-tn-text-muted/60"
          />
          <span className="text-[10px] text-tn-text-muted shrink-0 whitespace-nowrap">
            {catalogLoading ? "…" : `${filtered.length} match${filtered.length === 1 ? "" : "es"}`}
          </span>
        </div>
        {categories.length > 0 && (
          <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
            {[PREFAB_CATEGORY_ALL, ...categories].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setCategory(chip)}
                className={`shrink-0 px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                  category === chip
                    ? "border-tn-accent bg-tn-accent/15 text-tn-accent"
                    : "border-tn-border text-tn-text-muted hover:text-tn-text hover:bg-tn-surface"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>

      {emptyCatalog && (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-tn-text-muted space-y-2">
          <p>No prefabs in cache. Sync Hytale release assets first (onboarding or Settings → Assets).</p>
          {onRequestSync && isTauriRuntime() && (
            <button
              type="button"
              disabled={syncInProgress}
              onClick={onRequestSync}
              className="px-3 py-1 text-xs rounded border border-tn-accent/40 text-tn-accent hover:bg-tn-accent/10 disabled:opacity-50"
            >
              {syncInProgress ? "Syncing…" : "Sync now"}
            </button>
          )}
        </div>
      )}

      {catalog.error && (
        <p className="text-[11px] text-amber-400/90">{catalog.error}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 flex-1 min-h-[280px]">
        <div className="sm:w-[42%] shrink-0 flex flex-col min-h-[140px] sm:min-h-0 border border-tn-border/60 rounded bg-tn-bg/40 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-1">
            {catalogLoading && (
              <p className="px-2 py-3 text-[11px] text-tn-text-muted">Loading catalog…</p>
            )}
            {!catalogLoading &&
              visible.map((path) => {
                const active = value === path;
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => onChange(path)}
                    title={path}
                    className={`w-full text-left px-2 py-1 rounded text-[11px] truncate transition-colors ${
                      active
                        ? "bg-tn-accent/20 text-tn-accent"
                        : "text-tn-text-muted hover:bg-white/5 hover:text-tn-text"
                    }`}
                  >
                    {shortPrefabLeaf(path)}
                  </button>
                );
              })}
            {!catalogLoading && hiddenCount > 0 && (
              <p className="px-2 py-2 text-[10px] text-tn-text-muted">
                {hiddenCount} more — narrow the filter
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col min-h-[200px] border border-tn-border/60 rounded overflow-hidden bg-[#1c1a17]">
          <div className="shrink-0 px-2.5 py-1.5 border-b border-tn-border/40 bg-tn-panel/80 space-y-0.5">
            <p
              className="text-[10px] font-mono text-tn-text truncate"
              title={value || undefined}
            >
              {value || "Select a prefab"}
            </p>
            <p className="text-[10px] text-tn-text-muted">
              {preview.mesh
                ? `${preview.mesh.blockCount.toLocaleString()} blocks${preview.mesh.truncated ? " · capped" : ""} · drag to orbit`
                : preview.loading
                  ? "Loading preview…"
                  : value
                    ? "Preview unavailable"
                    : "Pick a path from the list"}
            </p>
          </div>
          <div className="relative flex-1 min-h-[180px]">
            {preview.error && !preview.loading && value && (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-amber-400/90 px-3 text-center z-10">
                {preview.error}
              </div>
            )}
            {preview.mesh && !preview.loading && (
              <PrefabPreview3D mesh={preview.mesh} className="absolute inset-0 w-full h-full" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
