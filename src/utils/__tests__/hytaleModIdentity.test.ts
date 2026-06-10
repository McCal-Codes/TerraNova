import { describe, expect, it } from "vitest";
import { deriveHytaleModIdentity } from "@/utils/hytaleModPaths";

describe("deriveHytaleModIdentity", () => {
  it("uses wizard manifest fields when present", () => {
    const identity = deriveHytaleModIdentity({
      name: "My Pack",
      hytaleGroup: "User",
      hytaleName: "My-Pack",
    });
    expect(identity).toEqual({
      modGroup: "User",
      modName: "My-Pack",
      modFolderName: "User.My-Pack",
    });
  });

  it("falls back to TerraNova export naming", () => {
    const identity = deriveHytaleModIdentity({ name: "Forest Hills" }, "ForestHills");
    expect(identity.modGroup).toBe("TerraNova");
    expect(identity.modFolderName).toMatch(/^TerraNova\./);
  });
});
