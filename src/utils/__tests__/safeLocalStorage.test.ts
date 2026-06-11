import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sanitizePersistedPath, safeJsonParse, safeStoredJson } from "@/utils/safeLocalStorage";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("sanitizePersistedPath", () => {
  it("trims and keeps normal mod pack paths", () => {
    const p = "  C:/Users/x/AppData/Hytale/UserData/Saves/Worldgen V1/mods/McCal.Autmn Forest  ";
    expect(sanitizePersistedPath(p)).toBe(p.trim());
  });

  it("rejects JSON blobs mistaken for paths", () => {
    expect(sanitizePersistedPath('{"saveModPacks":[]}')).toBe("");
  });
});

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    expect(safeJsonParse('{"alpha":1}', null)).toEqual({ alpha: 1 });
  });

  it("returns the fallback for invalid JSON", () => {
    expect(safeJsonParse("{not-json}", { ok: false })).toEqual({ ok: false });
  });
});

describe("safeStoredJson", () => {
  it("removes corrupted stored JSON and returns the fallback", () => {
    localStorage.setItem("tn-broken", "{");

    expect(safeStoredJson("tn-broken", { fallback: true })).toEqual({ fallback: true });
    expect(localStorage.getItem("tn-broken")).toBeNull();
  });
});
