import { describe, expect, it } from "vitest";
import {
  detectHydrographyContext,
  isHydrographyCellAtSlice,
  isWaterFluidMaterial,
  resolveWaterSurfaceY,
} from "../hydrographyContext";
import type { BiomeMaterialConfig } from "../materialResolver";

describe("hydrographyContext", () => {
  it("recognizes Hytale water fluid materials", () => {
    expect(isWaterFluidMaterial("Water_Source")).toBe(true);
    expect(isWaterFluidMaterial("Water")).toBe(true);
    expect(isWaterFluidMaterial("Lava_Source")).toBe(false);
    expect(isWaterFluidMaterial("")).toBe(false);
  });

  it("resolves shore-style TopY 0 + Water content field to surface Y", () => {
    const config: BiomeMaterialConfig = {
      layers: [],
      fluidLevel: 0,
      fluidMaterial: "Water_Source",
    };
    expect(resolveWaterSurfaceY(config, { Base: 100, Water: 100, Bedrock: 0 })).toBe(100);
  });

  it("resolves absolute SimpleHorizontal TopY as surface Y", () => {
    const config: BiomeMaterialConfig = {
      layers: [],
      fluidLevel: 64,
      fluidMaterial: "Water",
    };
    expect(resolveWaterSurfaceY(config, { Base: 100, Water: 100 })).toBe(64);
  });

  it("disables hydrography without a water fluid source", () => {
    expect(
      detectHydrographyContext(null, { Base: 100, Water: 100 }),
    ).toEqual({ enabled: false, waterSurfaceY: null, fluidMaterial: null });

    expect(
      detectHydrographyContext(
        { layers: [], fluidLevel: 0, fluidMaterial: "Lava_Source" },
        { Water: 100 },
      ).enabled,
    ).toBe(false);
  });

  it("enables hydrography when fluid and surface Y are configured", () => {
    expect(
      detectHydrographyContext(
        { layers: [], fluidLevel: 0, fluidMaterial: "Water_Source" },
        { Water: 100 },
      ),
    ).toEqual({
      enabled: true,
      waterSurfaceY: 100,
      fluidMaterial: "Water_Source",
    });
  });

  it("only marks open cells at or below the water surface", () => {
    expect(isHydrographyCellAtSlice(-0.5, 90, 100)).toBe(true);
    expect(isHydrographyCellAtSlice(-0.5, 110, 100)).toBe(false);
    expect(isHydrographyCellAtSlice(0.2, 50, 100)).toBe(false);
  });
});
