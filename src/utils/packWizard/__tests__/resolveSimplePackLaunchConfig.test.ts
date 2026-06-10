import { describe, expect, it } from "vitest";
import { DEFAULT_PACK_WIZARD_STATE } from "@/data/packWizardTemplates";
import { resolveSimplePackLaunchConfig } from "../resolveSimplePackLaunchConfig";

describe("resolveSimplePackLaunchConfig", () => {
  it("applies Hytale-style defaults for atmosphere and instance", () => {
    const resolved = resolveSimplePackLaunchConfig({
      ...DEFAULT_PACK_WIZARD_STATE,
      atmosphereMode: "import",
      includeStarterProps: true,
      instanceName: "",
    });

    expect(resolved.atmosphereMode).toBe("default");
    expect(resolved.includeStarterProps).toBe(false);
    expect(resolved.instanceName).toBe("DefaultInstance");
    expect(resolved.gameMode).toBe("Creative");
    expect(resolved.starterPrefabPath).toBe("");
    expect(resolved.primaryMaterialBlockId).toBe("Rock_Stone");
  });
});
