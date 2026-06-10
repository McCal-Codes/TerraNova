import { describe, expect, it } from "vitest";
import {
  curveSpecDefaults,
  getOrderedFieldKeys,
  isInlineCurveFieldKey,
  isInlineCurveSpec,
  matchesFieldFilter,
  resolvePropertyPanelTypeKey,
  shouldSkipPropertyField,
} from "../propertyPanelFields";

describe("propertyPanelFields", () => {
  it("resolves type key from rfType when present", () => {
    expect(resolvePropertyPanelTypeKey("Material:Constant", "Constant")).toBe("Material:Constant");
    expect(resolvePropertyPanelTypeKey("default", "SimplexNoise2D")).toBe("SimplexNoise2D");
  });

  it("detects inline curve specs", () => {
    expect(isInlineCurveSpec({ Type: "Manual", Points: [] })).toBe(true);
    expect(isInlineCurveSpec({ Type: "NotACurve" })).toBe(false);
    expect(isInlineCurveFieldKey("Curve", { Type: "Manual", Points: [] })).toBe(true);
  });

  it("orders fields by schema with extras last", () => {
    const keys = getOrderedFieldKeys(
      "SimplexNoise2D",
      { Seed: "B", Scale: 2, Lacunarity: 2, Persistence: 0.5, Octaves: 3, Extra: 1 },
      () => false,
    );
    expect(keys.indexOf("Lacunarity")).toBeLessThan(keys.indexOf("Scale"));
    expect(keys[keys.length - 1]).toBe("Extra");
  });

  it("skips dedicated inspector fields", () => {
    expect(shouldSkipPropertyField("WeightedAssignments", {
      isWeightedAssignmentNode: true,
      isAssignmentFieldFunctionNode: false,
      isMaterialFieldFunctionNode: false,
      isColumnPropNode: false,
      isPrefabNode: false,
    })).toBe(true);
    expect(shouldSkipPropertyField("DelimiterRanges", {
      isWeightedAssignmentNode: false,
      isAssignmentFieldFunctionNode: false,
      isMaterialFieldFunctionNode: true,
      isColumnPropNode: false,
      isPrefabNode: false,
    })).toBe(true);
  });

  it("builds curve defaults for type changes", () => {
    const manual = curveSpecDefaults("Manual");
    expect(manual.Type).toBe("Manual");
    expect(Array.isArray(manual.Points)).toBe(true);
  });

  it("filters fields by label or key", () => {
    expect(matchesFieldFilter("Scale", "Scale", "oct")).toBe(false);
    expect(matchesFieldFilter("Octaves", "Octaves", "oct")).toBe(true);
  });
});
