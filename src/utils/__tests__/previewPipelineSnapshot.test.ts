import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { getDensityImportStatus } from "@/utils/previewPipelineSnapshot";

function makeNode(id: string, type: string, fields: Record<string, unknown> = {}): Node {
  return {
    id,
    type: "generic",
    position: { x: 0, y: 0 },
    data: { type, fields, label: type },
  };
}

describe("getDensityImportStatus", () => {
  it("returns empty lists when graph has no external imports", () => {
    const nodes = [makeNode("n1", "Constant", { Value: 1 })];
    const edges: Edge[] = [];

    expect(getDensityImportStatus(nodes, edges)).toEqual({
      requested: [],
      resolved: [],
      missing: [],
    });
  });

  it("handles undefined edges and lists unbound imports as missing", () => {
    const nodes = [makeNode("imp", "Imported", { Name: "Plains1_Caves" })];

    const status = getDensityImportStatus(nodes, undefined);
    expect(status.requested).toEqual(["Plains1_Caves"]);
    expect(status.resolved).toEqual([]);
    expect(status.missing).toEqual(["Plains1_Caves"]);
  });

  it("skips Imported nodes with wired Input", () => {
    const nodes = [
      makeNode("bound", "Imported", { Name: "Inline_Module" }),
      makeNode("free", "Imported", { Name: "External_Module" }),
    ];
    const edges: Edge[] = [{ id: "e1", source: "other", target: "bound", targetHandle: "Input" }];

    expect(getDensityImportStatus(nodes, edges)).toEqual({
      requested: ["External_Module"],
      resolved: [],
      missing: ["External_Module"],
    });
  });
});
