import { useMemo, useState } from "react";
import { usePrefabPathCatalog } from "@/hooks/usePrefabPathCatalog";

interface PrefabPathBrowserProps {
  projectPath: string | null;
  selectedPath: string | null;
  graphPath: string | null;
  onSelectPath: (path: string) => void;
}

export function PrefabPathBrowser({
  projectPath,
  selectedPath,
  graphPath,
  onSelectPath,
}: PrefabPathBrowserProps) {
  const [filter, setFilter] = useState("");
  const catalog = usePrefabPathCatalog(projectPath, true);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return catalog.paths;
    return catalog.paths.filter((p: string) => p.toLowerCase().includes(q));
  }, [catalog.paths, filter]);

  const displayLimit = 400;
  const visible = filtered.slice(0, displayLimit);
  const hiddenCount = Math.max(0, filtered.length - visible.length);

  return (
    <div className="flex flex-col w-52 shrink-0 min-h-0 border border-tn-border rounded bg-tn-panel/40">
      <div className="shrink-0 p-2 border-b border-tn-border space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tn-text-muted">
          Prefab paths
        </p>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter…"
          className="w-full px-2 py-1 text-[11px] rounded border border-tn-border bg-tn-bg text-tn-text placeholder:text-tn-text-muted/60"
        />
        {graphPath && (
          <p className="text-[10px] text-tn-text-muted truncate" title={graphPath}>
            Graph: <span className="text-tn-text">{graphPath}</span>
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-1">
        {catalog.loading && (
          <p className="px-2 py-3 text-[11px] text-tn-text-muted">Loading catalog…</p>
        )}

        {!catalog.loading && catalog.error && (
          <p className="px-2 py-3 text-[11px] text-amber-400/90">{catalog.error}</p>
        )}

        {!catalog.loading && !catalog.error && catalog.paths.length === 0 && (
          <p className="px-2 py-3 text-[11px] text-tn-text-muted leading-snug">
            No prefabs found. Sync Hytale assets in Settings, or add Server/Prefabs to your pack.
          </p>
        )}

        {!catalog.loading &&
          visible.map((path: string) => {
            const active = selectedPath === path;
            const fromGraph = graphPath === path;
            return (
              <button
                key={path}
                type="button"
                onClick={() => onSelectPath(path)}
                title={path}
                className={`w-full text-left px-2 py-1 rounded text-[11px] truncate transition-colors ${
                  active
                    ? "bg-tn-accent/20 text-tn-accent"
                    : "text-tn-text-muted hover:bg-white/5 hover:text-tn-text"
                }`}
              >
                {path}
                {fromGraph && !active ? (
                  <span className="ml-1 text-[9px] opacity-70">· graph</span>
                ) : null}
              </button>
            );
          })}

        {!catalog.loading && hiddenCount > 0 && (
          <p className="px-2 py-2 text-[10px] text-tn-text-muted">
            {hiddenCount} more — narrow the filter
          </p>
        )}

        {!catalog.loading && catalog.truncated && (
          <p className="px-2 py-2 text-[10px] text-tn-text-muted">
            Catalog capped — use filter to find prefabs.
          </p>
        )}
      </div>
    </div>
  );
}
