import { describe, it, expect } from "vitest";
import {
  DEPRECATED_TYPE_KEYS,
  LEGACY_TYPE_KEYS,
  LEGACY_TYPE_REPLACEMENTS,
  NON_CANONICAL_PALETTE_TYPE_KEYS,
} from "@/nodes/shared/legacyTypes";
import { EDITOR_PREFIX_TO_BUNDLE_CATEGORY } from "../categoryPrefixes";
import { getUpdate6Type, isRegisteredType } from "../update6";

/**
 * The legacy list is hand-maintained; the registry is derived from Hytale's
 * source. Checking one against the other is how a type that quietly came back
 * — or never left — gets noticed.
 *
 * `Amplitude` was the case that prompted this: it sat in LEGACY_TYPE_KEYS while
 * Update 6 registered `AmplitudeDensityAsset` and a shipped biome used it, so
 * the palette hid a working node and offered to rewrite it into a node with
 * entirely different fields.
 */

/** Editor key ("Curve:Sum", or a bare name meaning Density) → registry key. */
function toRegistryKey(typeKey: string): [category: string, type: string] {
  const idx = typeKey.indexOf(":");
  if (idx < 0) return ["Density", typeKey];
  const prefix = typeKey.slice(0, idx);
  const bundleCategory = EDITOR_PREFIX_TO_BUNDLE_CATEGORY[prefix] ?? prefix;
  // The registry pluralises exactly one category name.
  const registryCategory = bundleCategory === "Assignment" ? "Assignments" : bundleCategory;
  return [registryCategory, typeKey.slice(idx + 1)];
}

describe("the legacy list against Hytale's registry", () => {
  it("marks nothing legacy that Update 6 still registers", () => {
    const stillRegistered = [...LEGACY_TYPE_KEYS].filter((k) =>
      isRegisteredType(...toRegistryKey(k)),
    );
    expect(stillRegistered).toEqual([]);
  });

  it("only calls a type deprecated when the source says so", () => {
    // Cache2D is the one deprecated type Update 6 still registers, and its
    // asset class carries the marker in its name.
    for (const key of DEPRECATED_TYPE_KEYS) {
      const type = getUpdate6Type(...toRegistryKey(key));
      if (!type) continue;
      expect(type.assetClass).toMatch(/Deprecated/);
    }
  });

  it("only redirects away from a registered type when the source deprecates it", () => {
    // Cache2D is registered, so it loads — but its asset class is
    // `Cache2dDensityAsset_Deprecated`, which is the source saying not to reach
    // for it in new graphs. A redirect away from any other registered type
    // would be sending the user off a node that works.
    const badRedirects = [...LEGACY_TYPE_REPLACEMENTS.keys()].filter((from) => {
      const type = getUpdate6Type(...toRegistryKey(from));
      return type != null && !/Deprecated/.test(type.assetClass);
    });
    expect(badRedirects).toEqual([]);
  });

  it("points every replacement at something the generator accepts", () => {
    const deadEnds: string[] = [];
    for (const [from, to] of LEGACY_TYPE_REPLACEMENTS) {
      if (!isRegisteredType(...toRegistryKey(to))) deadEnds.push(`${from} -> ${to}`);
    }
    // Curve:Manual and the Layer:* thickness nodes are registered; anything
    // that fails here would send the user to a node that cannot load either.
    expect(deadEnds).toEqual([]);
  });

  it("keeps Amplitude available, with its own fields", () => {
    expect(LEGACY_TYPE_KEYS.has("Amplitude")).toBe(false);
    expect(LEGACY_TYPE_REPLACEMENTS.has("Amplitude")).toBe(false);
    const amplitude = getUpdate6Type("Density", "Amplitude");
    expect(amplitude?.assetClass).toBe("AmplitudeDensityAsset");
    // Not interchangeable with AmplitudeConstant, which takes Scale/Offset.
    expect(amplitude?.fields.map((f) => f.name)).toContain("FunctionForY");
  });

  it("does not offer a non-canonical alias that the generator rejects outright", () => {
    // These are kept loadable on purpose, so they may be unregistered — but each
    // one must have somewhere to send the user.
    for (const key of NON_CANONICAL_PALETTE_TYPE_KEYS) {
      if (isRegisteredType(...toRegistryKey(key))) continue;
      expect(LEGACY_TYPE_REPLACEMENTS.has(key)).toBe(true);
    }
  });
});
