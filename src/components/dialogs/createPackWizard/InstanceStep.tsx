import type { PackWizardFormState } from "@/data/packWizardTemplates";
import { WizardField, wizardInputClass, wizardSelectClass } from "./WizardField";

interface InstanceStepProps {
  state: PackWizardFormState;
  onChange: (patch: Partial<PackWizardFormState>) => void;
}

export function InstanceStep({ state, onChange }: InstanceStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <WizardField label="Instance Name" hint="Folder under Server/Instances/.">
        <input
          type="text"
          value={state.instanceName}
          onChange={(e) => onChange({ instanceName: e.target.value })}
          className={wizardInputClass}
        />
      </WizardField>

      <WizardField label="World Structure">
        <input
          type="text"
          value="MainWorld"
          readOnly
          className={`${wizardInputClass} text-tn-text-muted`}
        />
      </WizardField>

      <WizardField label="Game Mode">
        <select
          value={state.gameMode}
          onChange={(e) => onChange({ gameMode: e.target.value })}
          className={wizardSelectClass}
        >
          <option value="Creative">Creative</option>
          <option value="Adventure">Adventure</option>
        </select>
      </WizardField>
    </div>
  );
}
