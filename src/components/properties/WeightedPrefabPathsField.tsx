import { useCallback, useMemo } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { PrefabPathSelect } from "./PrefabPathSelect";
import { usePrefabPathCatalog, selectPrefabCatalog } from "@/hooks/usePrefabPathCatalog";
import { openPrefab3DPreview } from "@/utils/previewActions";
import {
  readWeightedPrefabPaths,
  weightedAssignmentChance,
  writeWeightedPrefabPaths,
  type WeightedAssignmentEntry,
  type WeightedPrefabPathEntry,
} from "@/utils/weightedAssignmentSummary";

const WEIGHT_MIN = 1;
const WEIGHT_MAX = 10;

type WeightedPrefabPathsFieldProps =
  | {
      paths: WeightedPrefabPathEntry[];
      entry?: undefined;
      onChange: (next: WeightedPrefabPathEntry[]) => void;
      onBlur: () => void;
      projectPath?: string | null;
    }
  | {
      entry: WeightedAssignmentEntry;
      paths?: undefined;
      onChange: (next: WeightedAssignmentEntry) => void;
      onBlur: () => void;
      projectPath?: string | null;
    };

function resolvePaths(
  paths: WeightedPrefabPathEntry[] | undefined,
  entry: WeightedAssignmentEntry | undefined,
): WeightedPrefabPathEntry[] {
  if (paths) return paths;
  if (entry) return readWeightedPrefabPaths(entry);
  return [];
}

export function WeightedPrefabPathsField(props: WeightedPrefabPathsFieldProps) {
  const {
    paths: pathsProp,
    entry,
    onChange,
    onBlur,
    projectPath: projectPathProp,
  } = props;
  const storeProjectPath = useProjectStore((s) => s.projectPath);
  const projectPath = projectPathProp ?? storeProjectPath;
  const { catalog, loading: catalogLoading } = selectPrefabCatalog(
    usePrefabPathCatalog(projectPath, true),
  );
  const handleOpenPrefab3D = useCallback((path: string) => {
    openPrefab3DPreview(path);
  }, []);

  const paths = resolvePaths(pathsProp, entry);
  const totalWeight = useMemo(
    () => paths.reduce((sum, p) => sum + (typeof p.Weight === "number" ? p.Weight : 0), 0),
    [paths],
  );

  const updatePaths = (next: WeightedPrefabPathEntry[]) => {
    if (entry) {
      (onChange as (value: WeightedAssignmentEntry) => void)(
        writeWeightedPrefabPaths(entry, next),
      );
    } else {
      (onChange as (value: WeightedPrefabPathEntry[]) => void)(next);
    }
  };

  const updatePath = (index: number, path: string) => {
    updatePaths(paths.map((p, i) => (i === index ? { ...p, Path: path } : p)));
  };

  const updateWeight = (index: number, weight: number) => {
    if (!Number.isFinite(weight) || weight < WEIGHT_MIN) return;
    updatePaths(paths.map((p, i) => (i === index ? { ...p, Weight: weight } : p)));
  };

  const addPath = () => {
    updatePaths([...paths, { Path: "", Weight: 1 }]);
    onBlur();
  };

  const removePath = (index: number) => {
    if (paths.length <= 1) return;
    updatePaths(paths.filter((_, i) => i !== index));
    onBlur();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-tn-text-muted">
          Prefab variants ({paths.length})
        </span>
        <button
          type="button"
          onClick={addPath}
          className="text-[10px] text-tn-accent hover:text-tn-accent/80"
        >
          + Add prefab
        </button>
      </div>

      {paths.length === 0 && (
        <p className="text-[11px] text-tn-text-muted">No prefab paths — add one to place structures.</p>
      )}

      {catalogLoading && (
        <p className="text-[10px] text-tn-text-muted">Loading prefab catalog…</p>
      )}

      {!catalogLoading && catalog.error && (
        <p className="text-[10px] text-amber-400/90">{catalog.error}</p>
      )}

      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-0.5">
        {paths.map((row, index) => {
          const path = row.Path ?? "";
          const weight = typeof row.Weight === "number" ? row.Weight : 1;
          const chance = weightedAssignmentChance(weight, totalWeight);

          return (
            <div
              key={`prefab-row-${index}`}
              className="rounded border border-tn-border bg-tn-bg/40 p-2 flex flex-col gap-2"
            >
              <div className="flex items-start gap-2">
                <PrefabPathSelect
                  value={path}
                  projectPath={projectPath}
                  catalog={catalog}
                  catalogLoading={catalogLoading}
                  onChange={(next) => updatePath(index, next)}
                  onBlur={onBlur}
                  onPreview3D={handleOpenPrefab3D}
                />
                {paths.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePath(index)}
                    className="text-[10px] text-red-400 hover:text-red-300 shrink-0 mt-1"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[10px] text-tn-text-muted w-12 shrink-0">Weight</label>
                <input
                  type="range"
                  min={WEIGHT_MIN}
                  max={WEIGHT_MAX}
                  step={1}
                  value={Math.min(weight, WEIGHT_MAX)}
                  onChange={(e) => updateWeight(index, parseInt(e.target.value, 10))}
                  onBlur={onBlur}
                  className="flex-1 accent-tn-accent h-1.5"
                />
                <input
                  type="number"
                  min={WEIGHT_MIN}
                  step={1}
                  value={weight}
                  onChange={(e) => updateWeight(index, parseInt(e.target.value, 10))}
                  onBlur={onBlur}
                  className="w-10 px-1 py-0.5 text-[10px] bg-tn-bg border border-tn-border rounded text-right font-mono shrink-0"
                />
                {paths.length > 1 && totalWeight > 0 && (
                  <span className="text-[9px] text-tn-text-muted w-8 text-right shrink-0">
                    {chance >= 10 ? Math.round(chance) : chance.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
