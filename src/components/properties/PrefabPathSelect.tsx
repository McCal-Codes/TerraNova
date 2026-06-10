import { useMemo, useState } from "react";
import { usePrefabPathCatalog, selectPrefabCatalog } from "@/hooks/usePrefabPathCatalog";
import type { HytalePrefabPathCatalog } from "@/utils/hytaleBlockAssets/listHytalePrefabPaths";

interface PrefabPathSelectProps {
  value: string;
  projectPath: string | null;
  onChange: (path: string) => void;
  onBlur?: () => void;
  onPreview3D?: (path: string) => void;
  /** When provided, skips per-row catalog loading (parent loads once). */
  catalog?: HytalePrefabPathCatalog;
  catalogLoading?: boolean;
}

function shortPrefabLabel(path: string): string {
  if (!path) return "(none)";
  const leaf = path.split("/").pop() ?? path;
  return leaf.replace(/_/g, " ");
}

export function PrefabPathSelect({
  value,
  projectPath,
  onChange,
  onBlur,
  onPreview3D,
  catalog: catalogProp,
  catalogLoading: catalogLoadingProp,
}: PrefabPathSelectProps) {
  const [filter, setFilter] = useState("");
  const useOwnCatalog = catalogProp === undefined;
  const hook = usePrefabPathCatalog(projectPath, useOwnCatalog);
  const { catalog, loading } = selectPrefabCatalog(hook, catalogProp, catalogLoadingProp);

  const options = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let paths = catalog.paths;
    if (q) {
      paths = paths.filter((p) => p.toLowerCase().includes(q));
    }
    if (value && !paths.includes(value) && !catalog.paths.includes(value)) {
      paths = [value, ...paths];
    } else if (value && !paths.includes(value)) {
      paths = [value, ...paths];
    }
    return paths.slice(0, 200);
  }, [catalog.paths, filter, value]);

  const hiddenCount = Math.max(0, catalog.paths.length - options.length);

  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      {catalog.paths.length > 12 && (
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter prefabs…"
          className="w-full px-2 py-0.5 text-[10px] rounded border border-tn-border bg-tn-bg text-tn-text placeholder:text-tn-text-muted/60"
        />
      )}
      <div className="flex items-center gap-1.5">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          title={value || "Select prefab path"}
          className="flex-1 min-w-0 px-2 py-1 text-[11px] rounded border border-tn-border bg-tn-bg text-tn-text font-mono truncate"
        >
          <option value="">Select prefab…</option>
          {options.map((path) => (
            <option key={path} value={path} title={path}>
              {shortPrefabLabel(path)}
            </option>
          ))}
        </select>
        {onPreview3D && value && (
          <button
            type="button"
            onClick={() => onPreview3D(value)}
            className="shrink-0 text-[10px] px-2 py-1 rounded border border-tn-border text-tn-accent hover:bg-tn-accent/10"
            title="Open in 3D prefab preview"
          >
            3D
          </button>
        )}
      </div>
      {useOwnCatalog && loading && (
        <span className="text-[9px] text-tn-text-muted">Loading prefab catalog…</span>
      )}
      {!loading && catalog.error && (
        <span className="text-[9px] text-amber-400/90">{catalog.error}</span>
      )}
      {!loading && catalog.paths.length === 0 && !value && (
        <span className="text-[9px] text-tn-text-muted leading-snug">
          Sync Hytale assets in Settings or add Server/Prefabs to your pack.
        </span>
      )}
      {hiddenCount > 0 && (
        <span className="text-[9px] text-tn-text-muted">
          {hiddenCount} more — narrow filter
        </span>
      )}
    </div>
  );
}
