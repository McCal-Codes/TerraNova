import { describe, it, expect } from "vitest";
import { isLegacyTypeKey, isPaletteTypeKeyVisible } from "../shared/legacyTypes";

describe("legacy type corrections", () => {
  it("Environment:Imported and Tint:Imported are legacy after all", () => {
    // These were listed as active V2 types. Update 6's registry says otherwise:
    // Imported is registered for nineteen categories, and EnvironmentProvider
    // and TintProvider are not among them — they register only Constant and
    // DensityDelimited (plus Mix for Tint). Neither name appears in any of the
    // 26,871 shipped asset files under an environment or tint field.
    expect(isLegacyTypeKey("Environment:Imported")).toBe(true);
    expect(isLegacyTypeKey("Tint:Imported")).toBe(true);
  });

  it("Environment:Exported is still legacy", () => {
    expect(isLegacyTypeKey("Environment:Exported")).toBe(true);
  });

  it("Tint:Exported is still legacy", () => {
    expect(isLegacyTypeKey("Tint:Exported")).toBe(true);
  });

  it("scanner types are active V2 (not legacy)", () => {
    expect(isLegacyTypeKey("Scanner:ColumnLinear")).toBe(false);
    expect(isLegacyTypeKey("Scanner:ColumnRandom")).toBe(false);
    expect(isLegacyTypeKey("Scanner:Area")).toBe(false);
    expect(isLegacyTypeKey("Scanner:Origin")).toBe(false);
  });

  it("Position:Mesh2D and Mesh3D are active V2 (not legacy)", () => {
    expect(isLegacyTypeKey("Position:Mesh2D")).toBe(false);
    expect(isLegacyTypeKey("Position:Mesh3D")).toBe(false);
  });

  it("Prop:Box, Column, Cluster are active V2 (not legacy)", () => {
    expect(isLegacyTypeKey("Prop:Box")).toBe(false);
    expect(isLegacyTypeKey("Prop:Column")).toBe(false);
    expect(isLegacyTypeKey("Prop:Cluster")).toBe(false);
  });

  it("hides non-canonical density aliases from new-node palettes", () => {
    expect(isPaletteTypeKeyVisible("Product")).toBe(false);
    expect(isPaletteTypeKeyVisible("CacheOnce")).toBe(false);
    expect(isPaletteTypeKeyVisible("CurveFunction")).toBe(false);
    expect(isPaletteTypeKeyVisible("Cache2D")).toBe(false);
    expect(isPaletteTypeKeyVisible("Multiplier")).toBe(true);
    expect(isPaletteTypeKeyVisible("Cache")).toBe(true);
    expect(isPaletteTypeKeyVisible("CurveMapper")).toBe(true);
  });
});
