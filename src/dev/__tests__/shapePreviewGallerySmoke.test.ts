import { describe, expect, it } from "vitest";
import {
  GALLERY_CASES,
  getGalleryCaseSetup,
  isHytaleGalleryCase,
  parseGalleryCase,
} from "../shapePreviewGalleryCases";
import { evaluateCellShapeGrid } from "@/utils/shapePreview/cellShapeGrid";
import { getCellNoisePreviewFields } from "@/utils/shapePreview/cellNoisePreviewFields";
import { resolveShapePreviewMeshNodeId } from "@/utils/shapePreview/resolveShapePreviewMesh";
import { getNodeType } from "@/utils/density/evalTypes";

/**
 * Smoke: reference gallery cases are loadable and produce non-trivial shape-preview inputs.
 * Browser UAT: open `/?shape-preview-gallery=1&case=…` with dev server on port 1420.
 */
describe("shape preview gallery smoke", () => {
  const bundledCases = GALLERY_CASES.filter((id) => !isHytaleGalleryCase(id));

  it.each(bundledCases)("%s: loads reference biome with preview target", (caseId) => {
    const setup = getGalleryCaseSetup(caseId);
    const minNodes = caseId === "mudcracks-cube" ? 2 : caseId.startsWith("density-") ? 1 : 5;
    expect(setup.nodes.length).toBeGreaterThanOrEqual(minNodes);
    expect(setup.previewNodeId).toBeTruthy();
    if (caseId === "sdf-showcase") {
      expect(setup.referencePath).toBe("dev/shape-preview-sdf-showcase");
    } else if (caseId.startsWith("density-")) {
      expect(setup.referencePath).toBe("dev/density-basics-showcase");
    } else {
      expect(setup.referencePath).toMatch(/^templates\/references\//);
    }
  });

  it.each(["underworld-cell", "underworld-max"] as const)(
    "%s: extracts material layers for voxel preview",
    (caseId) => {
      const setup = getGalleryCaseSetup(caseId);
      expect(setup.materialConfig?.layers.length).toBeGreaterThan(0);
    },
  );

  it("underworld-cell: CellType Distance2Div produces cell edges", () => {
    const setup = getGalleryCaseSetup("underworld-cell");
    const target = setup.nodes.find((n) => n.id === setup.previewNodeId)!;
    const fields = getCellNoisePreviewFields(
      getNodeType(target),
      (target.data as Record<string, unknown>).fields as Record<string, unknown>,
      setup.yLevel,
    );
    expect(fields?.cellType).toBe("Distance2Div");
    expect(fields?.returnType).toBe("Distance2Div");
    const grid = evaluateCellShapeGrid(-64, 64, 96, fields!);
    let edges = 0;
    for (let i = 0; i < grid.edgeMask.length; i++) if (grid.edgeMask[i]) edges++;
    expect(edges).toBeGreaterThan(10);
  });

  it("tropical-pcn: resolves mesh for shape overlay", () => {
    const setup = getGalleryCaseSetup("tropical-pcn");
    const meshId = resolveShapePreviewMeshNodeId(
      setup.nodes,
      setup.edges,
      setup.previewNodeId,
    );
    expect(meshId).toBeTruthy();
  });

  it("legacy gallery URLs map to reference cases", () => {
    expect(parseGalleryCase("?case=pcn")).toBe("underworld-cell");
    expect(parseGalleryCase("?case=mix")).toBe("underworld-max");
    expect(parseGalleryCase("?case=sdf")).toBe("sdf-showcase");
  });

  it("sdf-showcase: each shape type is previewable with sdf preset", () => {
    const setup = getGalleryCaseSetup("sdf-showcase");
    expect(setup.preset).toBe("sdf");
    const types = new Set(
      [setup.previewNodeId, ...(setup.mixAltNodeIds ?? [])].map((id) => {
        const n = setup.nodes.find((node) => node.id === id)!;
        return getNodeType(n);
      }),
    );
    expect(types.has("Ellipsoid")).toBe(true);
    expect(types.has("Cuboid")).toBe(true);
    expect(types.has("Cylinder")).toBe(true);
    expect(types.has("Plane")).toBe(true);
    expect(types.has("Shell")).toBe(true);
    expect(types.has("Cube")).toBe(true);
  });
});
