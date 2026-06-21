import { describe, expect, it } from "vitest";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { normalizeImport } from "@/utils/fileTypeDetection";
import { getNodeType } from "@/utils/density/evalTypes";
import { findUpstreamCellNoiseNodes } from "../combinerShapePreview";
import { resolveShapePreviewTarget } from "../resolveShapePreviewTarget";
import { getGalleryCaseSetup } from "@/dev/shapePreviewGalleryCases";

describe("resolveShapePreviewTarget", () => {
  it("tropical-pcn targets PositionsCellNoise with pcnMesh preset", () => {
    const setup = getGalleryCaseSetup("tropical-pcn");
    const resolved = resolveShapePreviewTarget(setup.nodes, setup.edges);
    expect(resolved.shapePreviewEnabled).toBe(true);
    expect(resolved.preset).toBe("pcnMesh");
    const target = setup.nodes.find((n) => n.id === resolved.previewNodeId);
    expect(getNodeType(target!)).toBe("PositionsCellNoise");
  });

  it("underworld-max combiner resolves to a cell-capable combiner", () => {
    const setup = getGalleryCaseSetup("underworld-max");
    const resolved = resolveShapePreviewTarget(setup.nodes, setup.edges);
    expect(resolved.shapePreviewEnabled).toBe(true);
    const upstream = findUpstreamCellNoiseNodes(
      setup.nodes,
      setup.edges,
      resolved.previewNodeId!,
    );
    expect(upstream.length).toBeGreaterThan(0);
  });
});

describe("findUpstreamCellNoiseNodes — imported exports", () => {
  it("finds CellNoise2D inside an external density export", () => {
    const exportBody = normalizeImport({
      Type: "Max",
      Inputs: [
        {
          Type: "CellNoise2D",
          ScaleX: 20,
          ScaleY: 20,
          CellType: "Distance2Div",
          ReturnType: "Distance2Div",
        },
        { Type: "Constant", Value: 0 },
      ],
    });
    const sub = jsonToGraph(exportBody, 0, 0, "sub");

    const terrainBody = normalizeImport({
      Type: "Imported",
      Name: "Test_Cell_Module",
    });
    const { nodes, edges } = jsonToGraph(terrainBody, 0, 0, "terrain");
    const imported = nodes[0]!;

    const externalDensityExports = { Test_Cell_Module: sub };
    const upstream = findUpstreamCellNoiseNodes(
      nodes,
      edges,
      imported.id,
      6,
      externalDensityExports,
    );
    expect(upstream.some((n) => getNodeType(n) === "CellNoise2D")).toBe(true);
  });
});
