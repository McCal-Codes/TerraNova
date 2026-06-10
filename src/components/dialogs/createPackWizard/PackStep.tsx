import type { PackWizardFormState } from "@/data/packWizardTemplates";
import { usePackWizardBundleTemplates } from "@/hooks/usePackWizardBundleTemplates";
import { savePackWizardPreferences } from "@/utils/packWizard/packWizardPreferences";
import { WizardField, wizardInputClass, wizardSelectClass } from "./WizardField";

interface PackStepProps {
  state: PackWizardFormState;
  onChange: (patch: Partial<PackWizardFormState>) => void;
  onBrowse: () => void;
}

export function PackStep({ state, onChange, onBrowse }: PackStepProps) {
  const { worldStructureTemplates } = usePackWizardBundleTemplates();

  return (
    <div className="flex flex-col gap-4">
      <WizardField label="Pack Group" hint="Hytale mod manifest Group (e.g. User, McCal). Remembered for next pack.">
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

      <WizardField label="Pack Name" hint="Project folder name and export mod Name.">
        <input
          type="text"
          value={state.packName}
          onChange={(e) => onChange({ packName: e.target.value })}
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

      <WizardField label="World Structure Template">
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
        <p className="text-[11px] text-tn-text-muted mt-1">
          {worldStructureTemplates.find((t) => t.id === state.worldStructureTemplate)?.description}
        </p>
      </WizardField>
    </div>
  );
}
