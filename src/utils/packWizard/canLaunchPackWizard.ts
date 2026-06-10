import type { PackWizardFormState } from "@/data/packWizardTemplates";
import type { PackWizardUIMode } from "./packWizardPreferences";

/** Whether all required wizard fields are filled for launch. */
export function canLaunchPackWizard(
  state: PackWizardFormState,
  uiMode: PackWizardUIMode = "advanced",
): boolean {
  const base = Boolean(
    state.packGroup.trim()
    && state.packName.trim()
    && state.targetDir
    && state.biomeName.trim(),
  );
  if (uiMode === "simple") return base;
  return base && Boolean(state.instanceName.trim());
}
