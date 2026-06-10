import { describe, expect, it } from "vitest";
import { getGalleryCaseSetup } from "../shapePreviewGalleryCases";
import {
  buildMudcracksCubeGraph,
  buildSdfShowcaseGraph,
  SDF_SHOWCASE_TYPES,
} from "../shapePreviewSdfShowcase";
import { evaluateDensityGrid } from "@/utils/density/evaluateGrid";
import { marchingSquaresZeroContour } from "@/utils/shapePreview/marchingSquaresZeroContour";
import { isSdfType } from "@/utils/shapePreview/shapePreviewProfile";
import { getNodeType } from "@/utils/density/evalTypes";

const RANGE = { min: -64, max: 64, y: 0, res: 96 };

function zeroContourSegmentCount(
  nodes: ReturnType<typeof buildSdfShowcaseGraph>["nodes"],
  edges: ReturnType<typeof buildSdfShowcaseGraph>["edges"],
  rootId: string,
  yLevel: number,
): number {
  const { values } = evaluateDensityGrid(
    nodes,
    edges,
    RANGE.res,
    RANGE.min,
    RANGE.max,
    yLevel,
    rootId,
    { contentFields: { Base: 0 } },
  );
  const n = Math.round(Math.sqrt(values.length));
  return marchingSquaresZeroContour(values, n).length;
}

describe("shape preview SDF showcase", () => {
  it("builds all six SDF shape types as separate preview roots", () => {
    const { shapeNodeIds, nodes } = buildSdfShowcaseGraph();
    for (const t of SDF_SHOWCASE_TYPES) {
      expect(shapeNodeIds[t]).toBeTruthy();
      const node = nodes.find((n) => n.id === shapeNodeIds[t])!;
      expect(getNodeType(node)).toBe(t);
      expect(isSdfType(t)).toBe(true);
    }
  });

  it.each(SDF_SHOWCASE_TYPES)(
    "%s produces a non-empty density=0 contour at y=0",
    (shapeType) => {
      const { nodes, edges, shapeNodeIds } = buildSdfShowcaseGraph();
      const count = zeroContourSegmentCount(nodes, edges, shapeNodeIds[shapeType], RANGE.y);
      expect(count).toBeGreaterThan(0);
    },
  );

  it("gallery sdf-showcase case uses sdf preset and sub-targets", () => {
    const setup = getGalleryCaseSetup("sdf-showcase");
    expect(setup.preset).toBe("sdf");
    expect(setup.mixAltNodeIds?.length).toBe(5);
    expect(setup.yLevel).toBe(0);
  });

  it("mudcracks cube reference graph produces zero contour", () => {
    const { nodes, edges, cubeNodeId } = buildMudcracksCubeGraph();
    expect(getNodeType(nodes.find((n) => n.id === cubeNodeId)!)).toBe("Cube");
    const count = zeroContourSegmentCount(nodes, edges, cubeNodeId, 0);
    expect(count).toBeGreaterThan(0);

    const setup = getGalleryCaseSetup("mudcracks-cube");
    expect(setup.referencePath).toContain("Mudcracks");
  });
});
