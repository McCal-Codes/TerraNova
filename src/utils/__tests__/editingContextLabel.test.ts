import { describe, it, expect } from "vitest";
import { formatEditingContextDisplay } from "../editingContextLabel";

describe("formatEditingContextDisplay", () => {
  it("formats biome file with section", () => {
    const display = formatEditingContextDisplay({
      projectPath: "C:/Pack/McCal.Autmn Forest",
      currentFile: "C:/Pack/McCal.Autmn Forest/Server/HytaleGenerator/Biomes/AutumnForest_Bones.json",
      editingContext: "Biome",
      biomeConfig: { Name: "Autmn Forest Bones" },
      activeBiomeSection: "Props[2]",
    });
    expect(display.packName).toBe("McCal.Autmn Forest");
    expect(display.primary).toBe("Autmn Forest Bones");
    expect(display.section).toBe("Prop 2");
    expect(display.relativePath).toBe("Server/HytaleGenerator/Biomes/AutumnForest_Bones.json");
  });

  it("formats standalone prop file", () => {
    const display = formatEditingContextDisplay({
      projectPath: "C:/Pack/MyMod",
      currentFile: "C:/Pack/MyMod/Server/HytaleGenerator/Props/Rocks.json",
      editingContext: "Prop",
      biomeConfig: null,
      activeBiomeSection: null,
    });
    expect(display.primary).toBe("Prop");
    expect(display.section).toBe("Rocks");
  });
});
