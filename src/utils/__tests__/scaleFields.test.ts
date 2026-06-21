import { describe, it, expect } from "vitest";
import { resolveCellularJitter } from "@/utils/density/scaleFields";

describe("resolveCellularJitter", () => {
  it("clamps negative jitter to [0, 1]", () => {
    expect(resolveCellularJitter(-14.07)).toBe(1);
    expect(resolveCellularJitter(-0.5)).toBe(0.5);
  });

  it("clamps values above 1", () => {
    expect(resolveCellularJitter(2)).toBe(1);
  });

  it("passes through valid jitter", () => {
    expect(resolveCellularJitter(0.45)).toBe(0.45);
  });
});
