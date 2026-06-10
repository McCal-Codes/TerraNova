import { describe, expect, it } from "vitest";
import { suggestBiomeNameFromPack } from "@/utils/packWizard/packWizardPreferences";

describe("suggestBiomeNameFromPack", () => {
  it("maps MyPack to MyBiome", () => {
    expect(suggestBiomeNameFromPack("MyPack")).toBe("MyBiome");
  });

  it("appends Biome for generic pack names", () => {
    expect(suggestBiomeNameFromPack("Sky Islands")).toBe("Sky_IslandsBiome");
  });

  it("preserves names that already end with Biome", () => {
    expect(suggestBiomeNameFromPack("ForestHillsBiome")).toBe("ForestHillsBiome");
  });
});
