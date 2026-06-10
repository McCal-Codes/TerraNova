import type { PackWizardFormState } from "@/data/packWizardTemplates";

/** Defaults used when launching from Simple mode (Hytale-style essentials only). */
export function resolveSimplePackLaunchConfig(
  state: PackWizardFormState,
): PackWizardFormState {
  return {
    ...state,
    worldStructureTemplate: state.worldStructureTemplate || "basic",
    biomeTemplate: state.biomeTemplate || "basic",
    includeStarterProps: false,
    starterPrefabPath: "",
    primaryMaterialBlockId: state.primaryMaterialBlockId || "Rock_Stone",
    atmosphereMode: "default",
    atmosphereImportId: state.atmosphereImportId || "Env_Zone1_Forests",
    instanceName: state.instanceName.trim() || "DefaultInstance",
    gameMode: state.gameMode || "Creative",
  };
}
