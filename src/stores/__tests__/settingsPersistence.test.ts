import { beforeEach, describe, expect, it } from "vitest";
import { flushSettingsPersistence, useSettingsStore } from "@/stores/settingsStore";

const STORAGE_KEY = "tn-settings";

/**
 * The settings registry wraps this store without changing what it writes.
 * These tests pin the on-disk contract: the persisted payload's key set and
 * values must not drift, or existing users silently lose settings on upgrade.
 */

/** Every key the store has ever persisted, as of the registry work. */
const EXPECTED_KEYS = [
  "flowDirection",
  "autoLayoutOnOpen",
  "confirmOnNodeDelete",
  "autoCheckUpdates",
  "keybindingOverrides",
  "instantSaveEnabled",
  "instantSaveDebounceMs",
  "exportPath",
  "svgExportSettings",
  "hytaleAssetSyncEnabled",
  "hytaleAssetSourceChannel",
  "hytalePreReleaseAssetsPath",
  "hytaleReleaseAssetsPath",
  "hytaleCommonAssetsEnabled",
  "hytaleCommonAssetsPath",
  "developerMode",
  "autoEnableDeveloperModeInDev",
  "showDevToolsDock",
  "debugWorkerLogging",
  "showNodeIdsOnCanvas",
  "packBackupPromptEnabled",
  "packBackupParentFolder",
].sort();

function readPersisted(): Record<string, unknown> {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw, "nothing was persisted").toBeTruthy();
  return JSON.parse(raw!) as Record<string, unknown>;
}

describe("settings persistence contract", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it("persists exactly the documented key set", () => {
    useSettingsStore.getState().setInstantSaveEnabled(true);
    flushSettingsPersistence();
    expect(Object.keys(readPersisted()).sort()).toEqual(EXPECTED_KEYS);
  });

  it("round-trips values through the payload", () => {
    const s = useSettingsStore.getState();
    s.setFlowDirection("RL");
    s.setInstantSaveDebounceMs(450);
    s.setPackBackupParentFolder("/tmp/backups");
    flushSettingsPersistence();

    const persisted = readPersisted();
    expect(persisted.flowDirection).toBe("RL");
    expect(persisted.instantSaveDebounceMs).toBe(450);
    expect(persisted.packBackupParentFolder).toBe("/tmp/backups");

    s.setFlowDirection("LR");
    s.setInstantSaveDebounceMs(200);
    s.setPackBackupParentFolder("");
    flushSettingsPersistence();
  });

  it("coalesces a burst of writes into a single payload with the final values", () => {
    const s = useSettingsStore.getState();
    for (const ms of [210, 220, 230, 240, 250]) s.setInstantSaveDebounceMs(ms);
    // Nothing written yet — the debounce is still open.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    flushSettingsPersistence();
    expect(readPersisted().instantSaveDebounceMs).toBe(250);
    s.setInstantSaveDebounceMs(200);
    flushSettingsPersistence();
  });

  it("flushes pending writes so a quit cannot drop the last change", () => {
    useSettingsStore.getState().setShowNodeIdsOnCanvas(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    window.dispatchEvent(new Event("pagehide"));
    expect(readPersisted().showNodeIdsOnCanvas).toBe(true);

    useSettingsStore.getState().setShowNodeIdsOnCanvas(false);
    flushSettingsPersistence();
  });

  it("clamps out-of-range values before they reach the payload", () => {
    useSettingsStore.getState().setInstantSaveDebounceMs(10);
    flushSettingsPersistence();
    expect(readPersisted().instantSaveDebounceMs).toBe(100);
    useSettingsStore.getState().setInstantSaveDebounceMs(200);
    flushSettingsPersistence();
  });
});
