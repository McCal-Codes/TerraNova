import { describe, expect, it } from "vitest";
import { DEFAULT_PACK_WIZARD_STATE } from "@/data/packWizardTemplates";
import { canLaunchPackWizard } from "../canLaunchPackWizard";

describe("canLaunchPackWizard", () => {
  it("requires pack, location, and biome in simple mode", () => {
    expect(canLaunchPackWizard(DEFAULT_PACK_WIZARD_STATE, "simple")).toBe(false);
    expect(
      canLaunchPackWizard({
        ...DEFAULT_PACK_WIZARD_STATE,
        targetDir: "C:/Packs",
      }, "simple"),
    ).toBe(true);
  });

  it("requires instance name in advanced mode", () => {
    expect(
      canLaunchPackWizard({
        ...DEFAULT_PACK_WIZARD_STATE,
        targetDir: "C:/Packs",
      }, "advanced"),
    ).toBe(true);
  });

  it("rejects empty biome or instance names", () => {
    expect(
      canLaunchPackWizard({
        ...DEFAULT_PACK_WIZARD_STATE,
        targetDir: "C:/Packs",
        biomeName: "  ",
      }),
    ).toBe(false);
  });
});
