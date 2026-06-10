import { describe, expect, it } from "vitest";
import { getCellNoisePreviewFields } from "../cellNoisePreviewFields";

describe("getCellNoisePreviewFields", () => {
  it("maps imported Frequency to axis scale (TheUnderworld CellNoise2D)", () => {
    const params = getCellNoisePreviewFields(
      "CellNoise2D",
      { Frequency: 0.05, Jitter: 0.3, Seed: "A" },
      64,
    );
    expect(params).not.toBeNull();
    expect(params!.scaleX).toBeCloseTo(20, 5);
    expect(params!.scaleZ).toBeCloseTo(20, 5);
  });

  it("passes CellType as returnType when ReturnType omitted (TheUnderworld)", () => {
    const params = getCellNoisePreviewFields(
      "CellNoise2D",
      { Frequency: 0.05, CellType: "Distance2Div", Jitter: 0.3, Seed: "A" },
      64,
    );
    expect(params?.cellType).toBe("Distance2Div");
    expect(params?.returnType).toBe("Distance2Div");
  });

  it("uses Scale for PositionsCellNoise", () => {
    const params = getCellNoisePreviewFields(
      "PositionsCellNoise",
      { Scale: 60, Jitter: 0.5, Seed: "A" },
      0,
    );
    expect(params?.scale).toBe(60);
  });
});
