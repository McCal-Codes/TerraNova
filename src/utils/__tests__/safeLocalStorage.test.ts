import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  sanitizePersistedPath,
  safeJsonParse,
  safeStoredJson,
  safeLocalStorageSetItem,
  safeLocalStorageGetItem,
  pruneHistoryLocalStorage,
} from "@/utils/safeLocalStorage";

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

describe("pruneHistoryLocalStorage", () => {
  it("removes the largest tn-history entries up to maxRemove", () => {
    localStorage.setItem("tn-history:a", "x".repeat(100));
    localStorage.setItem("tn-history:b", "x".repeat(500));
    localStorage.setItem("tn-history:c", "x".repeat(200));
    localStorage.setItem("tn-other:z", "x".repeat(999)); // should not be touched

    const removed = pruneHistoryLocalStorage(2);

    expect(removed).toBe(2);
    // Two largest (b=500, c=200) removed; smallest (a=100) kept
    expect(localStorage.getItem("tn-history:a")).not.toBeNull();
    expect(localStorage.getItem("tn-history:b")).toBeNull();
    expect(localStorage.getItem("tn-history:c")).toBeNull();
    // Non-history key untouched
    expect(localStorage.getItem("tn-other:z")).not.toBeNull();
  });

  it("returns 0 when no history keys exist", () => {
    localStorage.setItem("tn-other:x", "data");
    expect(pruneHistoryLocalStorage()).toBe(0);
  });
});

describe("safeLocalStorageSetItem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true and stores the value on success", () => {
    const result = safeLocalStorageSetItem("tn-test", "hello");
    expect(result).toBe(true);
    expect(localStorage.getItem("tn-test")).toBe("hello");
  });

  it("prunes history and retries when the first write hits a quota error", () => {
    // Plant a history blob to be pruned
    localStorage.setItem("tn-history:big", "x".repeat(1000));

    let callCount = 0;
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === "tn-quota-target" && callCount++ === 0) {
        const err = new DOMException("QuotaExceededError", "QuotaExceededError");
        throw err;
      }
      return original.call(this, key, value);
    });

    const result = safeLocalStorageSetItem("tn-quota-target", "retried");
    expect(result).toBe(true);
    expect(localStorage.getItem("tn-quota-target")).toBe("retried");
    // History blob was pruned as part of recovery
    expect(localStorage.getItem("tn-history:big")).toBeNull();
  });

  it("returns false and logs a warning when quota is exhausted even after pruning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = new DOMException("QuotaExceededError", "QuotaExceededError");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw err;
    });

    const result = safeLocalStorageSetItem("tn-full", "data");
    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("localStorage full"));
  });

  it("re-throws non-quota errors", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new TypeError("unexpected");
    });

    expect(() => safeLocalStorageSetItem("tn-err", "x")).toThrow(TypeError);
  });
});

describe("safeLocalStorageGetItem", () => {
  it("returns large values without deleting them", () => {
    const big = "x".repeat(600);
    localStorage.setItem("tn-large", big);
    expect(safeLocalStorageGetItem("tn-large")).toBe(big);
    expect(localStorage.getItem("tn-large")).toBe(big);
  });

  it("returns value normally", () => {
    localStorage.setItem("tn-ok", "/some/path");
    expect(safeLocalStorageGetItem("tn-ok")).toBe("/some/path");
  });

  it("returns null for missing keys", () => {
    expect(safeLocalStorageGetItem("tn-missing")).toBeNull();
  });
});
