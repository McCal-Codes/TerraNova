import { beforeAll, describe, expect, it } from "vitest";
import { getAllSettings, getById } from "../index";
import { useSettingsStore } from "@/stores/settingsStore";
import { DEFAULTS as CONFIG_DEFAULTS } from "@/stores/configStore";

/**
 * Guards against the registry and the underlying stores drifting apart. If
 * someone adds a key to settingsStore or configStore without a definition, the
 * setting becomes invisible to search, modified-state and reset — silently.
 * This test is the tripwire.
 */

/** Keys that are deliberately not user-facing settings. */
const NOT_SETTINGS = new Set<string>([]);

function storeKeys(state: Record<string, unknown>): string[] {
  return Object.keys(state).filter(
    (key) => typeof state[key] !== "function" && !NOT_SETTINGS.has(key),
  );
}

describe("registry covers the settings stores", () => {
  let registeredIds: Set<string>;

  beforeAll(() => {
    registeredIds = new Set(getAllSettings().map((d) => d.id));
  });

  it("has an entry for every settingsStore key", () => {
    const claimed = new Set(getAllSettings().map((d) => d.storeKey).filter(Boolean));
    const missing = storeKeys(useSettingsStore.getState() as unknown as Record<string, unknown>).filter(
      (key) => !claimed.has(key),
    );
    expect(missing, `settingsStore keys without a registry definition: ${missing.join(", ")}`).toEqual([]);
  });

  it("claims each store key exactly once", () => {
    const keys = getAllSettings().map((d) => d.storeKey).filter(Boolean) as string[];
    const duplicates = keys.filter((key, i) => keys.indexOf(key) !== i);
    expect(duplicates, `storeKey claimed by more than one definition: ${duplicates.join(", ")}`).toEqual([]);
  });

  it("only claims store keys that actually exist", () => {
    const state = useSettingsStore.getState() as unknown as Record<string, unknown>;
    const bogus = getAllSettings()
      .filter((d) => d.storeKey && d.category !== "performance")
      .map((d) => d.storeKey!)
      .filter((key) => !(key in state));
    expect(bogus, `storeKey pointing at a non-existent field: ${bogus.join(", ")}`).toEqual([]);
  });

  it("has an entry for every configStore value", () => {
    const missing = Object.keys(CONFIG_DEFAULTS).filter(
      (key) => !registeredIds.has(`performance.${key}`),
    );
    expect(missing, `configStore keys without a registry definition: ${missing.join(", ")}`).toEqual([]);
  });

  it("registers unique, well-formed ids", () => {
    const all = getAllSettings();
    expect(registeredIds.size).toBe(all.length);
    for (const def of all) {
      expect(def.id, `${def.id} should be dotted lowerCamel`).toMatch(/^[a-z]+\.[a-zA-Z0-9]+$/);
    }
  });

  it("declares defaults matching the store's own defaults", () => {
    for (const key of Object.keys(CONFIG_DEFAULTS) as (keyof typeof CONFIG_DEFAULTS)[]) {
      const def = getById(`performance.${key}`);
      expect(def?.defaultValue, `performance.${key}`).toEqual(CONFIG_DEFAULTS[key]);
    }
  });

  it("gives every setting a label, category and at least one scope", () => {
    for (const def of getAllSettings()) {
      expect(def.label.length, def.id).toBeGreaterThan(0);
      expect(def.scopes.length, def.id).toBeGreaterThan(0);
      // Sentence case, not Title Case — labels are user-facing prose.
      expect(def.label[0], def.id).toBe(def.label[0]?.toUpperCase());
    }
  });

  it("points every deepLink at a real category", () => {
    for (const def of getAllSettings()) {
      if (!def.deepLink) continue;
      expect(def.control.kind, `${def.id} with a deepLink should be panel-owned`).toBe("panel");
    }
  });
});
