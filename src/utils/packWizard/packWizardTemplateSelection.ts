import {
  pairedWorldStructureForBiome,
  type PackWizardFormState,
} from "@/data/packWizardTemplates";

export function patchBiomeTemplateSelection(
  biomeTemplate: string,
): Partial<PackWizardFormState> {
  const patch: Partial<PackWizardFormState> = { biomeTemplate };
  const pairedWorld = pairedWorldStructureForBiome(biomeTemplate);
  if (pairedWorld) {
    patch.worldStructureTemplate = pairedWorld;
  }
  return patch;
}
