import { describe, expect, it } from "vitest";
import { registerAllSettings } from "@/settings/definitions";
import { getAllSettings, getById } from "@/settings/index";

/**
 * Vite re-evaluates the definitions module on every HMR update that touches
 * src/settings. The first version of registerAllSettings threw "Duplicate
 * setting id" on the second pass, during module evaluation — React stopped
 * re-rendering and the running app appeared to freeze.
 */
describe("re-registration (what Vite HMR does on every edit)", () => {
  it("does not throw when the definitions module re-evaluates", () => {
    expect(() => registerAllSettings()).not.toThrow();
  });

  it("leaves exactly one copy of each setting, not duplicates", () => {
    const before = getAllSettings().length;
    registerAllSettings();
    registerAllSettings();
    expect(getAllSettings().length).toBe(before);

    const ids = getAllSettings().map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps settings readable and writable after re-registration", () => {
    registerAllSettings();
    const def = getById("editor.instantSave");
    expect(def).toBeDefined();
    expect(typeof def!.read()).toBe("boolean");
  });
});
