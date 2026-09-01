import { describe, it, expect } from "vitest";
import bundle from "../../data/terranova-bundle.json";
import registryNodes from "../../data/hytale-update6-nodes.json";
import {
  allUpdate6Keys,
  getUpdate6Type,
  isRegisteredType,
  nodeAvailability,
  update6TypesIn,
} from "../update6";

/**
 * Guards the editor's node set against Hytale's own registry.
 *
 * The point is not to force the two to be equal — TerraNova has editor-side
 * constructs, and Update 6 registers whole subsystems the editor does not model
 * yet. The point is that every difference is *accounted for*: a new unregistered
 * type cannot appear in the palette without failing here, and the size of the
 * coverage gap cannot grow unnoticed.
 */

interface BundleNode {
  nodeType: string;
  category: string;
  isSubType?: boolean;
  fields?: Record<string, { type: string; default?: unknown }>;
}

const NODES = (bundle as unknown as { nodes: Record<string, BundleNode> }).nodes;

/** Bundle category names differ from the registry's in exactly one place. */
const BUNDLE_TO_REGISTRY: Record<string, string> = { Assignment: "Assignments" };

/**
 * Bundle keys are `Type` for some categories and `Category:Type` for others,
 * with bare aliases alongside prefixed entries. Collapsing to one identity is
 * what makes the comparison meaningful.
 */
function identity(key: string, node: BundleNode): { category: string; type: string } {
  const type = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key;
  return { category: BUNDLE_TO_REGISTRY[node.category] ?? node.category, type };
}

/** Registry key → the key form the derived node file uses. */
function toDerivedKey(registryKey: string): string {
  const [category, type] = registryKey.split(":") as [string, string];
  if (category === "Density") return type;
  const editorCategory = category === "Assignments" ? "Assignment" : category;
  return `${editorCategory}:${type}`;
}

const IDENTITIES = new Map<string, { category: string; type: string; node: BundleNode }>();
for (const [key, node] of Object.entries(NODES)) {
  const id = identity(key, node);
  IDENTITIES.set(`${id.category}:${id.type}`, { ...id, node });
}

describe("editor node set vs the Update 6 registry", () => {
  it("offers no node the generator would reject", () => {
    const rejected: string[] = [];
    for (const [key, { category, type, node }] of IDENTITIES) {
      const availability = nodeAvailability(category, type, { isSubType: node.isSubType });
      if (availability === "legacy") rejected.push(key);
    }
    // Every legacy type is listed in update6.ts with the reason it is there.
    // A new name here means an unregistered type reached the palette.
    expect(rejected.sort()).toEqual([
      "EnvironmentProvider:EnvironmentConstant",
      "EnvironmentProvider:EnvironmentDensityDelimited",
      "Pattern:Gap",
      "PositionProvider:Mesh",
      "PositionProvider:Positions",
      "Prop:Curve",
      "Prop:UniquePrefab",
      "TintProvider:TintConstant",
      "TintProvider:TintDensityDelimited",
    ]);
  });

  it("has an editor definition for every registered type", () => {
    // The curated bundle covers what someone wrote by hand; the derived file
    // covers the rest. Between them there should be no registered type the
    // editor cannot place. A gap here means the generator was not re-run after
    // a release added types.
    const derived = (registryNodes as unknown as { nodes: Record<string, unknown> }).nodes;
    const missing = allUpdate6Keys().filter(
      (k) => !IDENTITIES.has(k) && !(toDerivedKey(k) in derived),
    );
    expect(missing).toEqual([]);
  });

  it("keys types by category, because names are not unique across categories", () => {
    // "Imported" is registered under 19 categories; a name-keyed lookup would
    // return whichever happened to be registered last.
    const importedCategories = allUpdate6Keys()
      .filter((k) => k.endsWith(":Imported"))
      .map((k) => k.split(":")[0]);
    expect(importedCategories.length).toBeGreaterThan(1);
    expect(isRegisteredType("Density", "Imported")).toBe(true);
    expect(isRegisteredType("Curve", "Imported")).toBe(true);
  });

  it("does not confuse a type with a same-named one in another category", () => {
    // Both exist, and they take different fields.
    const densityClamp = getUpdate6Type("Density", "Clamp");
    const curveClamp = getUpdate6Type("Curve", "Clamp");
    expect(densityClamp?.assetClass).toBe("ClampDensityAsset");
    expect(curveClamp?.assetClass).not.toBe("ClampDensityAsset");
  });
});

describe("registry contents", () => {
  it("carries the fields and defaults read from the Java codec", () => {
    const clamp = getUpdate6Type("Density", "Clamp");
    expect(clamp?.fields.find((f) => f.name === "WallA")).toMatchObject({
      type: "number",
      required: true,
      default: -1,
    });
    // Inherited from DensityAsset.ABSTRACT_CODEC.
    expect(clamp?.fields.map((f) => f.name)).toEqual(
      expect.arrayContaining(["Inputs", "Skip", "ExportAs"]),
    );
  });

  it("resolves enum constants so the editor can offer a choice, not free text", () => {
    const trig = getUpdate6Type("Density", "Trig");
    expect(trig?.fields.find((f) => f.name === "Function")?.enum).toEqual([
      "Sin",
      "Cos",
      "Tan",
      "Asin",
      "Acos",
      "Atan",
    ]);
  });

  it("has no field left at an unrecognised codec type", () => {
    const unknown = allUpdate6Keys().flatMap((k) => {
      const t = getUpdate6Type(...(k.split(":") as [string, string]))!;
      return t.fields.filter((f) => f.type === "unknown").map((f) => `${k}.${f.name}`);
    });
    expect(unknown).toEqual([]);
  });

  it("knows the noise types the terrain preview depends on", () => {
    expect(update6TypesIn("Density")).toEqual(
      expect.arrayContaining(["SimplexNoise2D", "SimplexNoise3D", "CellNoise2D", "WhiteNoise"]),
    );
    // Ridge and fractal noise are not registered in Update 6, despite being in
    // the editor's type union — a graph using them will not load.
    expect(isRegisteredType("Density", "SimplexRidgeNoise2D")).toBe(false);
    expect(isRegisteredType("Density", "FractalNoise2D")).toBe(false);
  });
});
