import type { PackWizardFormState } from "@/data/packWizardTemplates";
import { usePackWizardBundleTemplates } from "@/hooks/usePackWizardBundleTemplates";
import { patchBiomeTemplateSelection } from "@/utils/packWizard/packWizardTemplateSelection";
import { savePackWizardPreferences } from "@/utils/packWizard/packWizardPreferences";
import { WizardField, wizardInputClass, wizardSelectClass } from "./WizardField";

interface SimplePackWizardFormProps {
  state: PackWizardFormState;
  onChange: (patch: Partial<PackWizardFormState>) => void;
  onBiomeChange: (patch: Partial<PackWizardFormState>) => void;
  onBrowse: () => void;
}

/** Hytale-style essentials: pack identity, biome name, and BASIC-style templates only. */
export function SimplePackWizardForm({
  state,
  onChange,
  onBiomeChange,
  onBrowse,
}: SimplePackWizardFormProps) {
  const { biomeTemplates, worldStructureTemplates, loading: templatesLoading } =
    usePackWizardBundleTemplates();
  const biomeTemplate = biomeTemplates.find((t) => t.id === state.biomeTemplate);
  const worldTemplate = worldStructureTemplates.find((t) => t.id === state.worldStructureTemplate);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-tn-text-muted">
        Match Hytale&apos;s pack launcher: pick a starter biome template (Simple Hills or a bundled world).
        World structure auto-pairs with your biome choice. Atmosphere uses the built-in default.
        Switch to Advanced for custom atmosphere, props, and Hytale reference exports.
      </p>

      <WizardField label="Pack Group" hint="Hytale mod manifest Group (e.g. User).">
        <input
          type="text"
          value={state.packGroup}
          onChange={(e) => onChange({ packGroup: e.target.value })}
          onBlur={() => {
            if (state.packGroup.trim() && state.targetDir) {
              savePackWizardPreferences({
                packGroup: state.packGroup.trim(),
                targetDir: state.targetDir,
              });
            }
          }}
          className={wizardInputClass}
        />
      </WizardField>

      <WizardField label="Pack Name" hint="Project folder and export mod Name.">
        <input
          type="text"
          value={state.packName}
          onChange={(e) => onChange({ packName: e.target.value })}
          className={wizardInputClass}
        />
      </WizardField>

      <WizardField label="Biome Name" hint="Synced from pack name until you edit it.">
        <input
          type="text"
          value={state.biomeName}
          onChange={(e) => onBiomeChange({ biomeName: e.target.value })}
          className={wizardInputClass}
        />
      </WizardField>

      <WizardField label="Location">
        <div className="flex gap-2">
          <input
            type="text"
            value={state.targetDir}
            readOnly
            placeholder="Select a parent directory..."
            className={`${wizardInputClass} flex-1 text-tn-text-muted`}
          />
          <button
            type="button"
            onClick={onBrowse}
            className="px-3 py-1.5 text-sm bg-tn-surface border border-tn-border rounded hover:bg-tn-accent/20 shrink-0"
          >
            Browse
          </button>
        </div>
      </WizardField>

      <WizardField
        label="Biome Template"
        hint={templatesLoading ? "Loading bundled templates…" : undefined}
      >
        <select
          value={state.biomeTemplate}
          onChange={(e) => onChange(patchBiomeTemplateSelection(e.target.value))}
          disabled={templatesLoading && biomeTemplates.length <= 1}
          className={wizardSelectClass}
        >
          {biomeTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName}
            </option>
          ))}
        </select>
        {biomeTemplate && (
          <p className="text-[11px] text-tn-text-muted mt-1">{biomeTemplate.description}</p>
        )}
      </WizardField>

      <WizardField
        label="World Structure Template"
        hint="Usually matches the biome template; change only if you know the pairing."
      >
        <select
          value={state.worldStructureTemplate}
          onChange={(e) => onChange({ worldStructureTemplate: e.target.value })}
          className={wizardSelectClass}
        >
          {worldStructureTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName}
            </option>
          ))}
        </select>
        {worldTemplate && (
          <p className="text-[11px] text-tn-text-muted mt-1">{worldTemplate.description}</p>
        )}
      </WizardField>
    </div>
  );
}
