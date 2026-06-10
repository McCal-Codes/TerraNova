import { describe, expect, it } from "vitest";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { resolveShapePreviewMeshNodeId } from "../resolveShapePreviewMesh";

describe("resolveShapePreviewMeshNodeId", () => {
  it("finds Mesh2D through Occurrence chain (Tropical-style PCN)", () => {
    const json = {
      Type: "PositionsCellNoise",
      MaxDistance: 300,
      Positions: {
        Type: "Occurrence",
        FieldFunction: { Type: "Constant", Value: -0.3 },
        Positions: {
          Type: "Mesh2D",
          PointGenerator: { Type: "Mesh", ScaleX: 60, ScaleY: 60, ScaleZ: 60, Seed: "A" },
        },
      },
    };
    const { nodes, edges } = jsonToGraph(json);
    const pcn = nodes.find((n) => n.type === "PositionsCellNoise")!;
    const meshId = resolveShapePreviewMeshNodeId(nodes, edges, pcn.id);
    expect(meshId).not.toBeNull();
    const mesh = nodes.find((n) => n.id === meshId)!;
    expect(mesh.type).toBe("Position:Mesh2D");
  });
});
