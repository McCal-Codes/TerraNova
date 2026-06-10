import type { PackWizardUIMode } from "@/utils/packWizard/packWizardPreferences";

interface PackWizardModeToggleProps {
  mode: PackWizardUIMode;
  onModeChange: (mode: PackWizardUIMode) => void;
}

export function PackWizardModeToggle({ mode, onModeChange }: PackWizardModeToggleProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-tn-border/70 bg-tn-bg/60 p-0.5"
      role="group"
      aria-label="Wizard detail level"
    >
      {(["simple", "advanced"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onModeChange(option)}
          aria-pressed={mode === option}
          className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
            mode === option
              ? "bg-tn-accent/15 text-tn-accent shadow-sm"
              : "text-tn-text-muted hover:text-tn-text"
          }`}
          title={
            option === "simple"
              ? "Hytale-style essentials — pack, biome, and world structure"
              : "Full wizard — atmosphere, instance, props, reference templates, review"
          }
        >
          {option === "simple" ? "Simple" : "Advanced"}
        </button>
      ))}
    </div>
  );
}
