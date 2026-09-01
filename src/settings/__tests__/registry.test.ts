import { beforeEach, describe, expect, it } from "vitest";
import {
  getByCategory,
  getById,
  getModifiedSettings,
  isModified,
  resetSetting,
  searchSettings,
  valuesEqual,
} from "../index";
import { useSettingsStore } from "@/stores/settingsStore";

describe("valuesEqual", () => {
  it("compares primitives", () => {
    expect(valuesEqual(1, 1)).toBe(true);
    expect(valuesEqual("a", "b")).toBe(false);
    expect(valuesEqual(null, null)).toBe(true);
    expect(valuesEqual(null, {})).toBe(false);
  });

  it("compares records structurally regardless of key order", () => {
    expect(valuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(valuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(valuesEqual({}, {})).toBe(true);
  });

  it("compares arrays by position", () => {
    expect(valuesEqual([1, 2], [1, 2])).toBe(true);
    expect(valuesEqual([1, 2], [2, 1])).toBe(false);
    expect(valuesEqual([1], { 0: 1 })).toBe(false);
  });
});

describe("modified state and reset", () => {
  beforeEach(() => {
    useSettingsStore.getState().setInstantSaveEnabled(false);
    useSettingsStore.getState().setInstantSaveDebounceMs(200);
  });

  it("reports a setting as unmodified at its default", () => {
    const def = getById("editor.instantSave")!;
    expect(isModified(def)).toBe(false);
  });

  it("reports a setting as modified once changed, and restores it on reset", () => {
    const def = getById("editor.instantSave")!;
    def.write(true);
    expect(isModified(def)).toBe(true);
    expect(useSettingsStore.getState().instantSaveEnabled).toBe(true);

    resetSetting(def);
    expect(isModified(def)).toBe(false);
    expect(useSettingsStore.getState().instantSaveEnabled).toBe(false);
  });

  it("writes through to the underlying store, not a shadow copy", () => {
    const def = getById("editor.instantSaveDebounceMs")!;
    def.write(450);
    expect(useSettingsStore.getState().instantSaveDebounceMs).toBe(450);
    expect(def.read()).toBe(450);
    resetSetting(def);
  });

  it("lists only modified settings", () => {
    const def = getById("editor.instantSave")!;
    def.write(true);
    expect(getModifiedSettings().map((d) => d.id)).toContain("editor.instantSave");
    resetSetting(def);
    expect(getModifiedSettings().map((d) => d.id)).not.toContain("editor.instantSave");
  });
});

describe("searchSettings", () => {
  it("returns nothing for an empty query", () => {
    expect(searchSettings("")).toEqual([]);
    expect(searchSettings("   ")).toEqual([]);
  });

  it("matches synonyms from searchTerms, not just the label", () => {
    const ids = searchSettings("autosave").map((d) => d.id);
    expect(ids).toContain("editor.instantSave");
  });

  it("matches on category and section names", () => {
    expect(searchSettings("saving").map((d) => d.id)).toContain("editor.instantSave");
  });

  it("matches multi-word queries as an AND", () => {
    expect(searchSettings("asset cache").map((d) => d.id)).toContain("assets.autoStalenessCheck");
    expect(searchSettings("asset zzzznope")).toEqual([]);
  });

  it("is case insensitive", () => {
    expect(searchSettings("AUTOSAVE").map((d) => d.id)).toContain("editor.instantSave");
  });

  it("hides developer-only settings unless developer mode is on", () => {
    expect(searchSettings("verbose worker").map((d) => d.id)).not.toContain(
      "developer.debugWorkerLogging",
    );
    expect(
      searchSettings("verbose worker", { developerMode: true }).map((d) => d.id),
    ).toContain("developer.debugWorkerLogging");
  });

  it("supports @modified", () => {
    const def = getById("editor.instantSave")!;
    resetSetting(def);
    expect(searchSettings("@modified").map((d) => d.id)).not.toContain("editor.instantSave");
    def.write(true);
    expect(searchSettings("@modified").map((d) => d.id)).toContain("editor.instantSave");
    resetSetting(def);
  });

  it("composes a token with free text", () => {
    const instant = getById("editor.instantSave")!;
    const autoLayout = getById("editor.autoLayoutOnOpen")!;
    instant.write(true);
    autoLayout.write(true);

    const ids = searchSettings("@modified autosave").map((d) => d.id);
    expect(ids).toContain("editor.instantSave");
    expect(ids).not.toContain("editor.autoLayoutOnOpen");

    resetSetting(instant);
    resetSetting(autoLayout);
  });

  it("supports @project scope filtering", () => {
    const ids = searchSettings("@project").map((d) => d.id);
    expect(ids).toContain("files.exportPath");
    expect(ids).not.toContain("editor.instantSave");
  });
});

describe("category grouping", () => {
  it("groups settings under their declared category", () => {
    const ids = getByCategory("editor").map((d) => d.id);
    expect(ids).toContain("editor.flowDirection");
    expect(ids).not.toContain("assets.sourceChannel");
  });

  it("registers panel-owned performance settings with a sub-tab deep link", () => {
    const def = getById("performance.maxWorkerThreads")!;
    expect(def.control.kind).toBe("panel");
    expect(def.deepLink).toEqual({ category: "performance", subTab: "cpu" });
  });
});
