import { describe, it, expect } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import {
  buildSubgraphClipboard,
  collectConnectedNodeIds,
  filterExportableNodeFields,
} from "../devTools";

function makeNode(id: string): Node {
  return {
    id,
    type: "Density:Constant",
    position: { x: 0, y: 0 },
    data: { type: "Constant", fields: { Value: 1, $NodeId: "hide-me", _comment: "note" } },
  };
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target };
}

describe("devTools", () => {
  it("filters exportable node fields", () => {
    expect(filterExportableNodeFields({
      Value: 1,
      $NodeId: "x",
      __internal: true,
      _comment: "note",
    })).toEqual({ Value: 1 });
  });

  it("collects downstream connected ids", () => {
    const edges = [makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("x", "y")];
    const ids = collectConnectedNodeIds("a", edges, "downstream");
    expect([...ids].sort()).toEqual(["a", "b", "c"]);
  });

  it("builds downstream subgraph including transitive targets", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c"), makeNode("x")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("c", "x"), makeEdge("y", "z")];
    const clip = buildSubgraphClipboard("a", nodes, edges, "downstream");
    expect(clip.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c", "x"]);
    expect(clip.edges).toHaveLength(3);
  });
});
