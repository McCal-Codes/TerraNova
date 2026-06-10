import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { sanitizeGraphNodesAndEdges } from "../sanitizeGraphNodes";

describe("sanitizeGraphNodesAndEdges", () => {
  it("removes undefined node entries and dangling edges", () => {
    const valid: Node = {
      id: "a",
      type: "Constant",
      position: { x: 0, y: 0 },
      data: { type: "Constant", fields: { Value: 1 } },
    };
    const nodes = [undefined, valid] as unknown as Node[];
    const edges: Edge[] = [
      { id: "e1", source: "missing", target: "a" },
      { id: "e2", source: "a", target: "a" },
    ];

    const { nodes: cleanNodes, edges: cleanEdges } = sanitizeGraphNodesAndEdges(nodes, edges);

    expect(cleanNodes).toHaveLength(1);
    expect(cleanNodes[0].id).toBe("a");
    expect(cleanEdges).toHaveLength(1);
    expect(cleanEdges[0].id).toBe("e2");
  });
});
