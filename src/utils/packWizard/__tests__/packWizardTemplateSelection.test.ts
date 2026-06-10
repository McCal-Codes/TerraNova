import { describe, expect, it } from "vitest";
import { patchBiomeTemplateSelection } from "../packWizardTemplateSelection";

describe("patchBiomeTemplateSelection", () => {
  it("pairs world structure with bundled biome templates", () => {
    expect(patchBiomeTemplateSelection("forest-hills")).toEqual({
      biomeTemplate: "forest-hills",
      worldStructureTemplate: "forest-hills",
    });
  });

  it("uses basic world for simple hills", () => {
    expect(patchBiomeTemplateSelection("basic")).toEqual({
      biomeTemplate: "basic",
      worldStructureTemplate: "basic",
    });
  });

  it("does not override world for reference biomes", () => {
    expect(patchBiomeTemplateSelection("reference:TwistWorldBiome")).toEqual({
      biomeTemplate: "reference:TwistWorldBiome",
    });
  });
});
