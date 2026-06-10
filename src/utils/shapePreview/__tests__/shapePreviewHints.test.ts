import { describe, it, expect } from "vitest";
import { getShapePreviewHints } from "../shapePreviewHints";
import type { Node, Edge } from "@xyflow/react";

const pcnNode: Node = {
  id: "pcn",
  type: "Density",
  position: { x: 0, y: 0 },
  data: { type: "PositionsCellNoise", fields: { Scale: 50, Seed: "a" } },
};

describe("getShapePreviewHints", () => {
  it("guides user when shape preview is off", () => {
    const hints = getShapePreviewHints([pcnNode], [], "pcn", null, {
      showShapePreview: false,
      showCellBoundaries: true,
      showWallDistance: true,
      showMeshSamples: false,
      showSdfSurface: false,
    });
    expect(hints[0].message).toMatch(/enable/i);
  });

  it("warns when mesh layer on but no Positions wire", () => {
    const hints = getShapePreviewHints([pcnNode], [] as Edge[], "pcn", null, {
      showShapePreview: true,
      showCellBoundaries: false,
      showWallDistance: false,
      showMeshSamples: true,
      showSdfSurface: false,
    });
    expect(hints.some((h) => h.message.includes("Mesh2D"))).toBe(true);
  });
});
