import { describe, it, expect } from "vitest";
import { marchingSquaresZeroContour } from "../marchingSquaresZeroContour";

describe("marchingSquaresZeroContour", () => {
  it("finds a horizontal zero crossing", () => {
    const n = 4;
    const values = new Float32Array(n * n);
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        values[row * n + col] = row < 2 ? -1 : 1;
      }
    }
    const segments = marchingSquaresZeroContour(values, n);
    expect(segments.length).toBeGreaterThan(0);
  });
});
