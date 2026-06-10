import { describe, expect, it } from "vitest";
import { sanitizePersistedPath } from "@/utils/safeLocalStorage";

describe("sanitizePersistedPath", () => {
  it("trims and keeps normal mod pack paths", () => {
    const p = "  C:/Users/x/AppData/Hytale/UserData/Saves/Worldgen V1/mods/McCal.Autmn Forest  ";
    expect(sanitizePersistedPath(p)).toBe(p.trim());
  });

  it("rejects JSON blobs mistaken for paths", () => {
    expect(sanitizePersistedPath('{"saveModPacks":[]}')).toBe("");
  });
});
