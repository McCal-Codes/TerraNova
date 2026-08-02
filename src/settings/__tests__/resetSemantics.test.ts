import { beforeEach, describe, expect, it } from "vitest";
import {
  getAllSettings,
  getByCategory,
  getById,
  isModified,
  resetCategory,
  resetSetting,
  searchSettings,
  valuesEqual,
} from "@/settings/index";
import { DEFAULTS as CONFIG_DEFAULTS, useConfigStore } from "@/stores/configStore";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Probing the semantics most likely to be wrong, rather than re-asserting the
 * happy paths already covered elsewhere.
 */

describe("reset restores every setting, including the cascading ones", () => {
  // performance.cpuCoresAllocated / gpuMemoryBudgetMb / ramBudgetMb write via
  // applyCpuBudget/applyGpuBudget/applyRamBudget, which deliberately
  // reconfigure *other* fields. Resetting a category runs them in registration
  // order, so a later reset could be clobbered by an earlier cascade.
  it("resetCategory('performance') leaves nothing modified", () => {
    const c = useConfigStore.getState();
    c.applyCpuBudget(2);
    c.setDebounceMs(1234);
    c.setMaxWorkerThreads(1);
    c.applyGpuBudget(512);
    c.setEnableShadows(!CONFIG_DEFAULTS.enableShadows);
    c.applyRamBudget(256);
    c.setMaxHistoryEntries(7);
    c.setDefaultVoxelRes(16);

    resetCategory("performance");

    const stillModified = getByCategory("performance").filter(isModified).map((d) => d.id);
    expect(stillModified, `not restored: ${stillModified.join(", ")}`).toEqual([]);
  });

  it("every setting round-trips: change it, reset it, back to default", () => {
    const failures: string[] = [];
    for (const def of getAllSettings()) {
      if (def.control.kind === "panel") continue; // exercised separately below
      const original = def.read();
      const probe = mutate(def.defaultValue);
      if (probe === undefined) continue;
      try {
        def.write(probe);
        resetSetting(def);
        if (isModified(def)) failures.push(def.id);
      } finally {
        def.write(original);
      }
    }
    expect(failures, `did not return to default after reset: ${failures.join(", ")}`).toEqual([]);
  });
});

/** Produces a value of the same shape that differs from the input. */
function mutate(value: unknown): unknown {
  if (typeof value === "boolean") return !value;
  if (typeof value === "number") return value + 1;
  if (typeof value === "string") return value === "release" ? "pre-release" : `${value}x`;
  if (value === null) return "/tmp/probe";
  return undefined;
}

describe("valuesEqual edge cases", () => {
  it("treats NaN as equal to itself, so a NaN default is not permanently modified", () => {
    expect(valuesEqual(NaN, NaN)).toBe(true);
  });

  it("does not confuse 0 and -0", () => {
    // Object.is distinguishes these; for settings they are the same value and
    // reporting "modified" for -0 vs 0 would be noise.
    expect(valuesEqual(0, -0)).toBe(true);
  });

  it("does not treat an object as equal to a lookalike with extra keys", () => {
    expect(valuesEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });

  it("compares nested objects, not just the top level", () => {
    expect(valuesEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
    expect(valuesEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });
});

describe("search robustness", () => {
  it("does not crash or misbehave on regex metacharacters", () => {
    for (const q of ["(", "[a-z]", "*", "a|b", "\\", ".*", "$^"]) {
      expect(() => searchSettings(q)).not.toThrow();
    }
  });

  it("ignores an unknown @token instead of treating it as text", () => {
    // "@nope" is not a known filter. Treating it as a search term would make
    // the query silently match nothing, which reads as "no such setting".
    const ids = searchSettings("@nope instant").map((d) => d.id);
    expect(ids).toContain("editor.instantSave");
  });

  it("returns nothing for whitespace and punctuation-only queries", () => {
    expect(searchSettings("   ")).toEqual([]);
  });
});

describe("panel-owned settings", () => {
  beforeEach(() => {
    useSettingsStore.getState().resetAllKeybindings();
  });

  it("resets keybinding overrides to empty", () => {
    const def = getById("shortcuts.keybindingOverrides")!;
    useSettingsStore.getState().setKeybindingOverride("save", "Ctrl+Q");
    expect(isModified(def)).toBe(true);

    resetSetting(def);
    expect(useSettingsStore.getState().keybindingOverrides).toEqual({});
    expect(isModified(def)).toBe(false);
  });

  it("every panel-owned setting carries a deepLink so its row can navigate", () => {
    const orphans = getAllSettings()
      .filter((d) => d.control.kind === "panel" && !d.deepLink)
      .map((d) => d.id);
    expect(orphans, `panel rows with nowhere to go: ${orphans.join(", ")}`).toEqual([]);
  });
});
