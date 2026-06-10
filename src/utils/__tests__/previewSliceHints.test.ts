import { describe, it, expect } from "vitest";
import {
  getUniformSlicePreviewHint,
  isUniformDensitySlice,
} from "../previewSliceHints";

describe("previewSliceHints", () => {
  describe("isUniformDensitySlice", () => {
    it("detects flat grids", () => {
      expect(isUniformDensitySlice(36, 36)).toBe(true);
      expect(isUniformDensitySlice(36, 36.0000001)).toBe(true);
    });

    it("rejects varying grids", () => {
      expect(isUniformDensitySlice(0, 1)).toBe(false);
    });
  });

  describe("getUniformSlicePreviewHint", () => {
    it("returns null when the slice varies", () => {
      expect(getUniformSlicePreviewHint("BaseHeight", 0, 1, 64)).toBeNull();
    });

    it("returns null for CurveMapper — use preview target guidance instead", () => {
      expect(getUniformSlicePreviewHint("CurveMapper", 0.5, 0.5, 64)).toBeNull();
    });

    it("explains BaseHeight at a Y slice", () => {
      const hint = getUniformSlicePreviewHint("BaseHeight", 36, 36, 64);
      expect(hint).toMatch(/Y=64/);
      expect(hint).toMatch(/Distance/i);
    });

    it("gives generic Y-slice guidance for Constant", () => {
      const hint = getUniformSlicePreviewHint("Constant", 1, 1, 64);
      expect(hint).toMatch(/horizontal slice/i);
    });

    it("mentions preview target for uniform Sum", () => {
      const hint = getUniformSlicePreviewHint("Sum", 0, 0, 64);
      expect(hint).toMatch(/Preview target/i);
      expect(hint).toMatch(/Sum/);
    });
  });
});
