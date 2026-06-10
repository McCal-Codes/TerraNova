import { describe, it, expect } from "vitest";
import {
  getManualCurveInRange,
  isLikelyNormalizedCurveOnBlockOffsetInput,
} from "../curveMapperDiagnostics";

describe("curveMapperDiagnostics", () => {
  it("detects normalized In range on block-offset input", () => {
    const range = getManualCurveInRange({
      Curve: {
        Type: "Manual",
        Points: [
          { In: 0, Out: 0 },
          { In: 0.5, Out: 0.5 },
          { In: 1, Out: 1 },
        ],
      },
    });
    expect(range).not.toBeNull();
    expect(isLikelyNormalizedCurveOnBlockOffsetInput(range!)).toBe(true);
  });

  it("accepts release-style block-offset In range", () => {
    const range = getManualCurveInRange({
      Points: [
        { In: -80, Out: 1 },
        { In: 0, Out: 0 },
        { In: 120, Out: -1 },
      ],
    });
    expect(range).not.toBeNull();
    expect(isLikelyNormalizedCurveOnBlockOffsetInput(range!)).toBe(false);
  });
});
