import type { PackWizardFormState } from "@/data/packWizardTemplates";
import { EnvironmentImportPicker } from "./EnvironmentImportPicker";

const ATMOSPHERE_OPTIONS = [
  {
    id: "default" as const,
    label: "Built-in default",
    description: "Use Hytale's built-in default environment — no extra files in your pack.",
  },
  {
    id: "custom" as const,
    label: "Create custom atmosphere",
    description: "Scaffold Env_* and Weather_* JSON files wired to your biome.",
  },
  {
    id: "import" as const,
    label: "Import from Hytale cache",
    description: "Copy a built-in environment + weather from synced Hytale assets (falls back to custom if missing).",
  },
];

interface AtmosphereStepProps {
  state: PackWizardFormState;
  onChange: (patch: Partial<PackWizardFormState>) => void;
}

export function AtmosphereStep({ state, onChange }: AtmosphereStepProps) {
  return (
    <div className="flex flex-col gap-3">
      {ATMOSPHERE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange({ atmosphereMode: opt.id })}
          className={`text-left px-3 py-2.5 rounded border text-sm ${
            state.atmosphereMode === opt.id
              ? "border-tn-accent bg-tn-accent/10"
              : "border-tn-border bg-tn-bg hover:bg-tn-surface"
          }`}
        >
          <span className="font-medium">{opt.label}</span>
          <p className="text-xs text-tn-text-muted mt-0.5">{opt.description}</p>
        </button>
      ))}

      {state.atmosphereMode === "import" && (
        <EnvironmentImportPicker
          value={state.atmosphereImportId}
          onChange={(atmosphereImportId) => onChange({ atmosphereImportId })}
        />
      )}
    </div>
  );
}
