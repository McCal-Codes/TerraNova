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

  it("reads and preserves large JSON blobs (>512 bytes) without deleting them", () => {
    // Simulate a persisted undo-history entry — these are routinely many KB.
    const bigPayload = {
      v: 1,
      t: Date.now(),
      g: {
        h: Array.from({ length: 5 }, (_, i) => ({
          nodes: Array.from({ length: 10 }, (_, j) => ({
            id: `node-${i}-${j}`,
            type: "BiomeRangeNode",
            position: { x: j * 100, y: i * 80 },
            data: { label: `Node ${i}-${j}`, value: Math.random() },
          })),
          edges: [],
          biomeRanges: [],
          noiseRangeConfig: null,
          biomeConfig: null,
          settingsConfig: null,
          label: `Step ${i}`,
        })),
        i: 4,
      },
    };
    const serialized = JSON.stringify(bigPayload);
    expect(serialized.length).toBeGreaterThan(512);

    localStorage.setItem("tn-history:/project:/file.json", serialized);

    const result = safeStoredJson("tn-history:/project:/file.json", null);
    expect(result).not.toBeNull();
    expect((result as typeof bigPayload).v).toBe(1);
    // The entry must NOT have been deleted.
    expect(localStorage.getItem("tn-history:/project:/file.json")).not.toBeNull();
  });

  it("returns fallback when key is absent", () => {
    expect(safeStoredJson("tn-missing", null)).toBeNull();
    expect(safeStoredJson("tn-missing", { def: true })).toEqual({ def: true });
  });
});
