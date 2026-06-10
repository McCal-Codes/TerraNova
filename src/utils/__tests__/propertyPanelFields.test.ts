import { describe, expect, it } from "vitest";
import {
  curveSpecDefaults,
  getOrderedFieldKeys,
  isBareManualCurveSpec,
  isConstantColorNodeColorField,
  isConstantColorSpec,
  isConstantValueSpec,
  isImportedRefSpec,
  isFunctionForYFieldKey,
  isSwitchCasesArray,
  isFunctionForYSpec,
  isInOutPointsArray,
  isInlineCurveFieldKey,
  isInlineCurveSpec,
  isVector2Spec,
  inferCurvePointFormat,
  matchesFieldFilter,
  resolvePropertyPanelTypeKey,
  shouldSkipPropertyField,
} from "../propertyPanelFields";

describe("propertyPanelFields", () => {
  it("resolves type key from rfType when present", () => {
    expect(resolvePropertyPanelTypeKey("Material:Constant", "Constant")).toBe("Material:Constant");
    expect(resolvePropertyPanelTypeKey("default", "SimplexNoise2D")).toBe("SimplexNoise2D");
  });

  it("detects FunctionForY height envelopes", () => {
    const spec = {
      Points: [
        { Y: 8, Out: 1 },
        { Y: 20, Out: 0.36 },
      ],
    };
    expect(isFunctionForYSpec(spec)).toBe(true);
    expect(isFunctionForYFieldKey("FunctionForY", spec)).toBe(true);
    expect(isFunctionForYFieldKey("Curve", spec)).toBe(false);
  });

  it("detects inline curve specs", () => {
    expect(isInlineCurveSpec({ Type: "Manual", Points: [] })).toBe(true);
    expect(isInlineCurveSpec({ Type: "NotACurve" })).toBe(false);
    expect(isInlineCurveFieldKey("Curve", { Type: "Manual", Points: [] })).toBe(true);
  });

  it("detects bare manual curve objects and point arrays", () => {
    const bare = { Points: [{ In: 0, Out: 1 }, { In: 1, Out: 0 }] };
    expect(isBareManualCurveSpec(bare)).toBe(true);
    expect(isBareManualCurveSpec({ Type: "Manual", Points: bare.Points })).toBe(false);
    expect(isInOutPointsArray(bare.Points)).toBe(true);
    expect(inferCurvePointFormat(bare.Points)).toBe("inOut");
  });

  it("detects nested constant and 2D vectors", () => {
    expect(isConstantValueSpec({ Type: "Constant", Value: 0.5 })).toBe(true);
    expect(isConstantValueSpec({ Type: "Constant", Color: "#fff" })).toBe(false);
    expect(isConstantColorSpec({ Type: "Constant", Color: "#fff" })).toBe(true);
    expect(isVector2Spec({ x: 1, y: 2 })).toBe(true);
  });

  it("detects Tint:Constant node Color field for color picker", () => {
    expect(isConstantColorNodeColorField("Tint:Constant", "Constant", "Color")).toBe(true);
    expect(isConstantColorNodeColorField("Tint:Gradient", "Gradient", "From")).toBe(false);
    expect(isConstantColorNodeColorField("Material:Constant", "Constant", "Color")).toBe(false);
  });

  it("detects imported refs and switch cases", () => {
    expect(isImportedRefSpec({ Type: "Imported", Name: "Env_Test" })).toBe(true);
    expect(isImportedRefSpec({ Type: "Imported", Name: "X", Extra: 1 })).toBe(false);
    expect(
      isSwitchCasesArray([
        { State: "surface", InputIndex: 0 },
        { State: "caves", InputIndex: 1 },
      ]),
    ).toBe(true);
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
