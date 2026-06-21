import { describe, expect, it } from "vitest";
import {
  BUNDLED_GALLERY_CASES,
  DENSITY_BASICS_GALLERY_CASES,
  GALLERY_CASES,
  HYTALE_GALLERY_CASES,
  getGalleryCaseSetup,
  parseGalleryCase,
} from "../shapePreviewGalleryCases";
import { evaluateDensityGrid } from "@/utils/density/evaluateGrid";
import { evaluateCellShapeGrid } from "@/utils/shapePreview/cellShapeGrid";
import { getCellNoisePreviewFields } from "@/utils/shapePreview/cellNoisePreviewFields";
import { getNodeType } from "@/utils/density/evalTypes";
import { isSdfType } from "@/utils/shapePreview/shapePreviewProfile";
import { resolveShapePreviewMeshNodeId } from "@/utils/shapePreview/resolveShapePreviewMesh";
import { buildCellShapeGridForTarget } from "@/utils/shapePreview/buildCellShapeGridForTarget";
import { findUpstreamCellNoiseNodes } from "@/utils/shapePreview/combinerShapePreview";
import { extractMaterialConfig } from "@/utils/materialResolver";
import { hytaleToInternalBiome } from "@/utils/hytaleToInternal";
import underworldBiome from "../../../templates/references/TheUnderworld.json";

const RANGE = { min: -64, max: 64, y: 0, res: 96 };

function evalAtTarget(setup: ReturnType<typeof getGalleryCaseSetup>) {
  const targetId = setup.previewNodeId ?? setup.outputNodeId ?? undefined;
  return evaluateDensityGrid(
    setup.nodes,
    setup.edges,
    RANGE.res,
    RANGE.min,
    RANGE.max,
    setup.yLevel,
    targetId,
    { contentFields: { Base: 0 } },
  );
}

describe("shape preview gallery cases (reference biomes)", () => {
  it("defines bundled reference-backed UAT cases", () => {
    expect(BUNDLED_GALLERY_CASES).toEqual([
      "underworld-cell",
      "underworld-max",
      "tropical-pcn",
      "sdf-showcase",
      "mudcracks-cube",
      ...DENSITY_BASICS_GALLERY_CASES,
    ]);
  });

  it("appends Hytale cache-backed gallery cases", () => {
    expect(HYTALE_GALLERY_CASES).toEqual([
      "hytale-example-cellnoise2d",
      "hytale-generative-arches",
      "hytale-generative-veins",
      "hytale-plains1-river",
      "hytale-plains1-deeproot",
      "hytale-test-features",
    ]);
    expect(GALLERY_CASES).toEqual([...BUNDLED_GALLERY_CASES, ...HYTALE_GALLERY_CASES]);
  });

  it("maps legacy gallery URLs", () => {
    expect(parseGalleryCase("?case=pcn")).toBe("underworld-cell");
    expect(parseGalleryCase("?case=mix")).toBe("underworld-max");
    expect(parseGalleryCase("?case=sdf")).toBe("sdf-showcase");
    expect(parseGalleryCase("?case=cube")).toBe("mudcracks-cube");
  });

  it("underworld-cell: cell grid + material config from reference", () => {
    const setup = getGalleryCaseSetup("underworld-cell");
    expect(setup.referencePath).toBe("templates/references/TheUnderworld.json");
    expect(setup.materialConfig?.layers.length).toBeGreaterThan(0);

    const target = setup.nodes.find((n) => n.id === setup.previewNodeId)!;
    expect(getNodeType(target)).toBe("CellNoise2D");

    const fields = getCellNoisePreviewFields(
      getNodeType(target),
      (target.data as Record<string, unknown>).fields as Record<string, unknown>,
      setup.yLevel,
    );
    expect(fields).not.toBeNull();
    const grid = evaluateCellShapeGrid(RANGE.min, RANGE.max, RANGE.res, fields!);
    let edges = 0;
    for (let i = 0; i < grid.edgeMask.length; i++) if (grid.edgeMask[i]) edges++;
    expect(edges).toBeGreaterThan(10);
  });

  it("underworld-max: Max root is not SDF; CellNoise sub-targets have cell fields", () => {
    const setup = getGalleryCaseSetup("underworld-max");
    const maxNode = setup.nodes.find((n) => n.id === setup.outputNodeId)!;
    expect(getNodeType(maxNode)).toBe("Max");
    expect(isSdfType(getNodeType(maxNode))).toBe(false);
    expect(setup.mixAltNodeIds?.length).toBe(2);

    const maxVals = evalAtTarget(setup).values;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < maxVals.length; i++) {
      if (maxVals[i] < min) min = maxVals[i];
      if (maxVals[i] > max) max = maxVals[i];
    }
    expect(max).toBeGreaterThan(min);

    for (const altId of setup.mixAltNodeIds ?? []) {
      const cell = setup.nodes.find((n) => n.id === altId)!;
      expect(getNodeType(cell)).toBe("CellNoise2D");
      const fields = getCellNoisePreviewFields(
        getNodeType(cell),
        (cell.data as Record<string, unknown>).fields as Record<string, unknown>,
        setup.yLevel,
      );
      expect(fields).not.toBeNull();
    }

    const upstream = findUpstreamCellNoiseNodes(setup.nodes, setup.edges, maxNode.id);
    expect(upstream.length).toBeGreaterThanOrEqual(2);

    const merged = buildCellShapeGridForTarget(
      setup.nodes,
      setup.edges,
      maxNode,
      RANGE.min,
      RANGE.max,
      RANGE.res,
      setup.yLevel,
    );
    expect(merged).not.toBeNull();
    let edges = 0;
    for (let i = 0; i < merged!.edgeMask.length; i++) if (merged!.edgeMask[i]) edges++;
    expect(edges).toBeGreaterThan(10);
  });

  it("tropical-pcn: PositionsCellNoise with Mesh2D positions input", () => {
    const setup = getGalleryCaseSetup("tropical-pcn");
    expect(setup.referencePath).toBe(
      "templates/references/Tropical_Pirate_Islands.json",
    );
    expect(setup.preset).toBe("pcnMesh");

    const target = setup.nodes.find((n) => n.id === setup.previewNodeId)!;
    expect(getNodeType(target)).toBe("PositionsCellNoise");

    const meshId = resolveShapePreviewMeshNodeId(
      setup.nodes,
      setup.edges,
      setup.previewNodeId,
    );
    expect(meshId).not.toBeNull();
    const meshNode = setup.nodes.find((n) => n.id === meshId)!;
    expect(getNodeType(meshNode).replace(/^Position:/, "")).toBe("Mesh2D");

    const { values } = evalAtTarget(setup);
    expect(values.length).toBe(RANGE.res * RANGE.res);
  });

  it("TheUnderworld import matches gallery material extraction", () => {
    const { wrapper } = hytaleToInternalBiome(underworldBiome as Record<string, unknown>);
    const fromWrapper = extractMaterialConfig(wrapper);
    const fromGallery = getGalleryCaseSetup("underworld-cell").materialConfig;
    expect(fromGallery?.layers.length).toBe(fromWrapper?.layers.length);
  });
});
