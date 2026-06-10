import { describe, it, expect } from "vitest";
import { findManualCurveZeroCrossingIn } from "@/utils/curveMapperDiagnostics";

describe("findManualCurveZeroCrossingIn", () => {
  it("finds zero at midpoint of canonical height profile", () => {
    const zeroIn = findManualCurveZeroCrossingIn({
      Points: [{ In: 0, Out: 1 }, { In: 200, Out: -1 }],
    });
    expect(zeroIn).toBeCloseTo(100, 5);
  });
});
