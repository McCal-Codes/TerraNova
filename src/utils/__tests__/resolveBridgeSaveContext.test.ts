import { describe, expect, it } from "vitest";
import {
  resolveBridgeDiscoveryHints,
  resolveBridgeSaveContextFromPath,
} from "@/utils/resolveBridgeSaveContext";

describe("resolveBridgeSaveContextFromPath", () => {
  it("parses embedded save mod pack root", () => {
    const path =
      "C:/Users/me/AppData/Roaming/Hytale/UserData/Saves/Worldgen V1/mods/McCal.Volume Lab";
    const ctx = resolveBridgeSaveContextFromPath(path);
    expect(ctx?.saveName).toBe("Worldgen V1");
    expect(ctx?.modPackFolder).toBe("McCal.Volume Lab");
    expect(ctx?.saveRoot).toContain("/Saves/Worldgen V1");
    expect(ctx?.modPackPath).toContain("McCal.Volume Lab");
  });

  it("parses project file inside pack", () => {
    const path =
      "C:\\Users\\me\\AppData\\Roaming\\Hytale\\UserData\\Saves\\Worldgen V1\\mods\\McCal.Volume Lab\\Server\\HytaleGenerator\\Biomes\\x.json";
    const ctx = resolveBridgeSaveContextFromPath(path);
    expect(ctx?.modPackFolder).toBe("McCal.Volume Lab");
    expect(ctx?.saveName).toBe("Worldgen V1");
  });
});

describe("resolveBridgeDiscoveryHints", () => {
  it("prefers server mod path over project", () => {
    const base = "C:/Users/me/AppData/Roaming/Hytale/UserData/Saves";
    const hints = resolveBridgeDiscoveryHints(
      `${base}/Alpha/mods/PackA`,
      `${base}/Beta/mods/PackB/Server/foo.json`,
    );
    expect(hints.saveName).toBe("Alpha");
    expect(hints.modPackPath).toContain("PackA");
  });
});
