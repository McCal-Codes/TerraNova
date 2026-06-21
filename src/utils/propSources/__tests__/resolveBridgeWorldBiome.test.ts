import { describe, expect, it } from "vitest";

import { resolveBridgeSaveContextFromPath } from "@/utils/resolveBridgeSaveContext";
import { resolveBridgeWorldStructureName } from "@/utils/propSources/resolveBridgeWorldBiome";

describe("resolveBridgeSaveContextFromPath", () => {
  it("parses embedded save mod pack paths on Windows-style paths", () => {
    const path =
      "C:/Users/test/AppData/Roaming/Hytale/UserData/Saves/MyWorld/mods/Author.Pack";
    const ctx = resolveBridgeSaveContextFromPath(path);
    expect(ctx?.saveName).toBe("MyWorld");
    expect(ctx?.modPackFolder).toBe("Author.Pack");
    expect(ctx?.modPackPath).toContain("/mods/Author.Pack");
  });
});

describe("resolveBridgeWorldStructureName", () => {
  it("prefers instance world structure over discovery labels", () => {
    expect(
      resolveBridgeWorldStructureName({
        instanceWorldStructure: "ForestHills",
        discovery: {
          portOpen: true,
          saveName: "Test",
          playerWorldLabel: "Forest Hills (display)",
          instanceWorlds: [{ worldId: "w1", label: "Live", worldStructure: "Plains1", isLive: true }],
        },
      }),
    ).toBe("ForestHills");
  });

  it("falls back to live instance world structure", () => {
    expect(
      resolveBridgeWorldStructureName({
        discovery: {
          portOpen: true,
          saveName: "Test",
          instanceWorlds: [
            { worldId: "w1", label: "Other", worldStructure: "Desert1", isLive: false },
            { worldId: "w2", label: "Live", worldStructure: "Boreal1_Henges", isLive: true },
          ],
        },
      }),
    ).toBe("Boreal1_Henges");
  });
});
