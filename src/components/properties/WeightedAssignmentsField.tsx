import { useMemo } from "react";
import {
  DEFAULT_WEIGHTED_ASSIGNMENT_ENTRY,
  summarizeWeightedAssignmentEntry,
  totalWeightedAssignmentWeight,
  weightedAssignmentChance,
  type WeightedAssignmentEntry,
} from "@/utils/weightedAssignmentSummary";
import { ColumnPropFields } from "./ColumnPropFields";
import { WeightedPrefabPathsField } from "./WeightedPrefabPathsField";

interface WeightedAssignmentsFieldProps {
  entries: WeightedAssignmentEntry[];
  onChange: (next: WeightedAssignmentEntry[]) => void;
  onBlur: () => void;
}

export function WeightedAssignmentsField({
  entries,
  onChange,
  onBlur,
}: WeightedAssignmentsFieldProps) {
  const totalWeight = useMemo(() => totalWeightedAssignmentWeight(entries), [entries]);

  const updateEntry = (index: number, next: WeightedAssignmentEntry) => {
    onChange(entries.map((e, i) => (i === index ? next : e)));
  };

  const updateWeight = (index: number, weight: number) => {
    if (!Number.isFinite(weight) || weight < 0) return;
    updateEntry(index, { ...entries[index], Weight: weight });
  };

  const addEntry = () => {
    onChange([...entries, structuredClone(DEFAULT_WEIGHTED_ASSIGNMENT_ENTRY)]);
    onBlur();
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 1) return;
    onChange(entries.filter((_, i) => i !== index));
    onBlur();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-tn-text-muted">
          Weighted entries
        </span>
        <button
          type="button"
          onClick={addEntry}
          className="text-[10px] text-tn-accent hover:text-tn-accent/80"
        >
          + Add entry
        </button>
      </div>

      {entries.length === 0 && (
        <p className="text-[11px] text-tn-text-muted">No weighted assignments — add an entry.</p>
      )}

      {entries.map((entry, index) => {
        const weight = typeof entry.Weight === "number" ? entry.Weight : 1;
        const chance = weightedAssignmentChance(weight, totalWeight);
        const prop = entry.Assignments?.Prop as Record<string, unknown> | undefined;
        const propType = (prop?.Type as string) ?? null;
        const isColumn = propType === "Column";
        const summary = summarizeWeightedAssignmentEntry(entry);

        return (
          <div
            key={index}
            className="rounded border border-tn-border bg-tn-bg/40 p-2 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-tn-text">Entry {index + 1}</p>
                <p className="text-[10px] text-tn-text-muted truncate" title={summary}>
                  {summary}
                </p>
              </div>
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEntry(index)}
                  className="text-[10px] text-red-400 hover:text-red-300 shrink-0"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] text-tn-text-muted w-12 shrink-0">Weight</label>
              <input
                type="number"
                min={0}
                step={1}
                value={weight}
                onChange={(e) => updateWeight(index, parseFloat(e.target.value))}
                onBlur={onBlur}
                className="w-20 px-2 py-0.5 text-xs bg-tn-bg border border-tn-border rounded text-right font-mono"
              />
              {entries.length > 1 && totalWeight > 0 && (
                <span className="text-[10px] text-tn-text-muted">
                  ≈ {chance.toFixed(chance >= 10 ? 0 : 1)}% pick rate
                </span>
              )}
            </div>

            {isColumn && (
              <ColumnPropFields
                prop={(prop ?? { Type: "Column" }) as Record<string, unknown>}
                onChange={(nextProp) => {
                  updateEntry(index, {
                    ...entry,
                    Assignments: {
                      ...(entry.Assignments ?? { Type: "Constant" }),
                      Prop: nextProp,
                    },
                  });
                }}
                onBlur={onBlur}
              />
            )}

            {propType === "Prefab" && (
              <WeightedPrefabPathsField
                entry={entry}
                onChange={(next) => updateEntry(index, next)}
                onBlur={onBlur}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
