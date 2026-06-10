import { describe, expect, it } from "vitest";
import {
  isHytaleSaveModPackPath,
  packBackupSkipStorageKey,
  suggestPackBackupPath,
} from "@/utils/alphaPackBackup";

describe("suggestPackBackupPath", () => {
  it("places default backup beside pack under .terranova-backups", () => {
    const path = suggestPackBackupPath(
      "C:\\Users\\McCal\\Saves\\Worldgen V1\\mods\\MyMod",
      "12345",
    );
    expect(path).toBe(
      "C:\\Users\\McCal\\Saves\\Worldgen V1\\mods\\.terranova-backups\\MyMod-12345",
    );
  });

  it("uses custom parent when provided", () => {
    const path = suggestPackBackupPath(
      "/home/test/mods/PackA",
      "999",
      "/tmp/backups",
    );
    expect(path).toBe("/tmp/backups/PackA-999");
  });
});

describe("isHytaleSaveModPackPath", () => {
  it("detects embedded save mod packs", () => {
    expect(
      isHytaleSaveModPackPath(
        "C:/Users/x/AppData/Roaming/Hytale/UserData/Saves/Worldgen V1/mods/McCal.Test",
      ),
    ).toBe(true);
    expect(isHytaleSaveModPackPath("C:/Projects/fresh-pack")).toBe(false);
  });
});

describe("packBackupSkipStorageKey", () => {
  it("normalizes path casing", () => {
    expect(packBackupSkipStorageKey("C:\\Pack\\A")).toBe(
      packBackupSkipStorageKey("c:/pack/a"),
    );
  });
});
