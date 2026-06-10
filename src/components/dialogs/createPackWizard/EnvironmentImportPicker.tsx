import { useMemo } from "react";
import { useHytaleEnvironmentIds } from "@/hooks/useHytaleEnvironmentIds";
import { WizardField, wizardInputClass, wizardSelectClass } from "./WizardField";

interface EnvironmentImportPickerProps {
  value: string;
  onChange: (environmentId: string) => void;
}

export function EnvironmentImportPicker({ value, onChange }: EnvironmentImportPickerProps) {
  const { ids, source, error, loading } = useHytaleEnvironmentIds(true);

  const options = useMemo(() => {
    const set = new Set(ids);
    if (value.trim() && !set.has(value)) {
      return [value, ...ids];
    }
    return ids;
  }, [ids, value]);

  const selected = value || "Env_Zone1_Forests";

  return (
    <WizardField
      label="Hytale environment"
      hint={
        loading
          ? "Loading environments from synced assets…"
          : source === "cache"
            ? "Built-in environments from your synced Hytale asset cache."
            : "Showing built-in names — sync Hytale assets for your installed list."
      }
    >
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading && options.length === 0}
        className={wizardSelectClass}
      >
        {options.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-[11px] text-amber-400/90 mt-1">{error}</p>
      )}
      <details className="mt-2">
        <summary className="text-[11px] text-tn-text-muted cursor-pointer select-none">
          Custom environment ID
        </summary>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Env_Zone1_Forests"
          className={`${wizardInputClass} mt-1.5`}
        />
      </details>
    </WizardField>
  );
}
