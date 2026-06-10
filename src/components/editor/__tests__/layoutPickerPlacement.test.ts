import { describe, it, expect } from "vitest";
import { shouldShowLayoutPresetPicker } from "@/components/editor/LayoutPresetPicker";
import { defaultLayoutPickerPosition } from "@/utils/layoutPickerPosition";

describe("layout picker placement", () => {
  it("shows on density and biome contexts", () => {
    expect(shouldShowLayoutPresetPicker("Density")).toBe(true);
    expect(shouldShowLayoutPresetPicker("Biome")).toBe(true);
  });

  it("hides on asset editor contexts without graph/preview layouts", () => {
    expect(shouldShowLayoutPresetPicker("Weather")).toBe(false);
    expect(shouldShowLayoutPresetPicker("Environment")).toBe(false);
    expect(shouldShowLayoutPresetPicker("Settings")).toBe(false);
    expect(shouldShowLayoutPresetPicker(null)).toBe(false);
  });

  it("recommends bottom-center as default canvas anchor", () => {
    const { x, y } = defaultLayoutPickerPosition(1000, 500, 220, 30);
    expect(x).toBe(390);
    expect(y).toBe(458);
    expect(y).toBeGreaterThan(250);
  });
});
