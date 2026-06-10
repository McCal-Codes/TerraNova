import {
  biomeTemplateIncludesStarterProps,
  isReferenceBiomeTemplate,
  type PackWizardFormState,
} from "@/data/packWizardTemplates";
import { usePackWizardBundleTemplates } from "@/hooks/usePackWizardBundleTemplates";
import { patchBiomeTemplateSelection } from "@/utils/packWizard/packWizardTemplateSelection";
import { WizardField, wizardInputClass, wizardSelectClass } from "./WizardField";
import { StarterPropPicker } from "./StarterPropPicker";
import { MaterialBlockPicker } from "./MaterialBlockPicker";

interface BiomeStepProps {
  state: PackWizardFormState;
  onChange: (patch: Partial<PackWizardFormState>) => void;
}

export function BiomeStep({ state, onChange }: BiomeStepProps) {
  const { advancedBiomeTemplates, loading: templatesLoading } = usePackWizardBundleTemplates();
  const selected = advancedBiomeTemplates.find((t) => t.id === state.biomeTemplate);

  return (
    <div className="flex flex-col gap-4">
      <WizardField label="Biome Name" hint="Synced from pack name until you edit it. Filename and JSON Name must match.">
        <input
          type="text"
          value={state.biomeName}
          onChange={(e) => onChange({ biomeName: e.target.value })}
          className={wizardInputClass}
        />
      </WizardField>

      <WizardField
        label="Biome Template"
        hint={templatesLoading ? "Loading bundled templates…" : undefined}
      >
        <select
          value={state.biomeTemplate}
          onChange={(e) => onChange(patchBiomeTemplateSelection(e.target.value))}
          disabled={templatesLoading && advancedBiomeTemplates.length <= 1}
          className={wizardSelectClass}
        >
          {advancedBiomeTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName}
            </option>
          ))}
        </select>
        {selected && (
          <p className="text-[11px] text-tn-text-muted mt-1">{selected.description}</p>
        )}
        {isReferenceBiomeTemplate(state.biomeTemplate) && (
          <p className="text-[11px] text-amber-400/90 mt-2">
            Reference exports are complex and may use unsupported node types or props. Expect extra validation work after launch.
          </p>
        )}
      </WizardField>

      <label className="flex items-center gap-2 text-sm text-tn-text cursor-pointer">
        <input
          type="checkbox"
          checked={state.includeStarterProps}
          onChange={(e) => onChange({ includeStarterProps: e.target.checked })}
          className="accent-tn-accent"
        />
        Include starter props from template (when available)
      </label>
      {state.includeStarterProps && !biomeTemplateIncludesStarterProps(state.biomeTemplate) && (
        <p className="text-[11px] text-amber-400/90 -mt-2">
          This template does not ship prop nodes — use a custom prefab path below or pick Forest Hills / Eldritch / Archipelago.
        </p>
      )}

      <StarterPropPicker
        value={state.starterPrefabPath}
        onChange={(starterPrefabPath) => onChange({ starterPrefabPath })}
      />
      {state.starterPrefabPath.trim() && state.includeStarterProps && (
        <p className="text-[11px] text-tn-text-muted -mt-2">
          Custom prefab is appended after template props when both are enabled.
        </p>
      )}

      {state.biomeTemplate === "basic" && (
        <MaterialBlockPicker
          value={state.primaryMaterialBlockId}
          onChange={(primaryMaterialBlockId) => onChange({ primaryMaterialBlockId })}
        />
      )}
    </div>
  );
}
