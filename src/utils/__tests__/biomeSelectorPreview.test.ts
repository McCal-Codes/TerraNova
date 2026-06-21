import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import {
  buildBiomeSelectorMap,
  biomeAtMapPixel,
} from "../biomeSelectorPreview";

function constantNode(id: string, value: number): Node {
  return {
    id,
    type: "Constant",
    position: { x: 0, y: 0 },
    data: { type: "Constant", fields: { Value: value }, label: "Constant" },
  };
}

describe("biomeSelectorPreview", () => {
  it("maps constant selector to single biome index", () => {
    const nodes: Node[] = [constantNode("root", -0.5)];
    const edges: Edge[] = [];
    const ranges = [
      { Biome: "Plains", Min: -1, Max: -0.3 },
      { Biome: "Forest", Min: -0.3, Max: 0.3 },
      { Biome: "Mountains", Min: 0.3, Max: 1 },
    ];

    const map = buildBiomeSelectorMap(nodes, edges, ranges, {
      resolution: 8,
      rootNodeId: "root",
    });

    expect(map.biomeIndices.every((idx) => idx === 0)).toBe(true);

    const hit = biomeAtMapPixel(map, ranges, "Plains", 0, 0);
    expect(hit.biome).toBe("Plains");
    expect(hit.index).toBe(0);
  });
});
