interface WizardFieldProps {
  label: string;
  children: React.ReactNode;
  /** Rendered between label and children (preferred for long help text). */
  description?: string;
  /** Rendered after children (legacy; avoid when children include tall previews). */
  hint?: string;
}

export function WizardField({ label, children, description, hint }: WizardFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-tn-text-muted">{label}</label>
      {description && <p className="text-[11px] text-tn-text-muted">{description}</p>}
      {children}
      {hint && <p className="text-[11px] text-tn-text-muted">{hint}</p>}
    </div>
  );
}

export const wizardInputClass =
  "px-2 py-1.5 text-sm bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none w-full";

export const wizardSelectClass =
  "px-2 py-1.5 text-sm bg-tn-bg border border-tn-border rounded focus:border-tn-accent outline-none w-full";
