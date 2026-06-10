import { describe, expect, it } from "vitest";
import { evaluateDensityVolume } from "@/utils/volumeEvaluator";
import { buildSdfShowcaseGraph, SDF_GALLERY_VOXEL_Y } from "@/dev/shapePreviewSdfShowcase";
import { marchingSquaresZeroContourAtWorldY } from "../volumeSliceZeroContour";

describe("volumeSliceZeroContour", () => {
  it("cuboid and ellipsoid slices at y=0 produce different contours when Y is centered on origin", () => {
    const { nodes, edges, shapeNodeIds } = buildSdfShowcaseGraph();
    const n = 48;
    const ys = 48;
    const { min: yMin, max: yMax } = SDF_GALLERY_VOXEL_Y;

    const ellipsoid = evaluateDensityVolume(
      nodes,
      edges,
      n,
      -64,
      64,
      yMin,
      yMax,
      ys,
      shapeNodeIds.Ellipsoid,
      { contentFields: { Base: 0 } },
    );
    const cuboid = evaluateDensityVolume(
      nodes,
      edges,
      n,
      -64,
      64,
      yMin,
      yMax,
      ys,
      shapeNodeIds.Cuboid,
      { contentFields: { Base: 0 } },
    );

    const ellSegs = marchingSquaresZeroContourAtWorldY(
      ellipsoid.densities,
      n,
      ys,
      yMin,
      yMax,
      0,
    );
    const boxSegs = marchingSquaresZeroContourAtWorldY(
      cuboid.densities,
      n,
      ys,
      yMin,
      yMax,
      0,
    );

    expect(ellSegs.length).toBeGreaterThan(0);
    expect(boxSegs.length).toBeGreaterThan(0);
    // Cuboid slice at y=0 should be a rectangle-ish contour, not identical to ellipsoid ring.
    expect(boxSegs.length).not.toBe(ellSegs.length);
  });
});
