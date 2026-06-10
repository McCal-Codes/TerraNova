import { describe, expect, it } from "vitest";
import {
  getShapePreviewModeHint,
  shouldShowShapeCellMap,
} from "../previewModeRouting";

describe("previewModeRouting", () => {
  it("recommends 2D for PCN and mesh types", () => {
    expect(getShapePreviewModeHint("PositionsCellNoise")?.recommended).toBe("2d");
    expect(getShapePreviewModeHint("Mesh2D")?.recommended).toBe("2d");
  });

  it("recommends 2D for SDF with voxel note in reason", () => {
    const hint = getShapePreviewModeHint("Cube");
    expect(hint?.recommended).toBe("2d");
    expect(hint?.reason).toMatch(/Voxel/i);
  });

  it("flags cell map for cell and mesh profiles", () => {
    expect(shouldShowShapeCellMap("CellNoise2D")).toBe(true);
    expect(shouldShowShapeCellMap("Mesh3D")).toBe(true);
    expect(shouldShowShapeCellMap("Cube")).toBe(false);
  });
});
