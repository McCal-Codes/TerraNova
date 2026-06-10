import { describe, it, expect } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { getGraphOutputStatus } from "@/utils/graphOutputStatus";

const identity = (t: string) => t;

function node(id: string, type: string, extra: Record<string, unknown> = {}): Node {
  return {
    id,
    type: type === "Root" ? "Root" : "default",
    position: { x: 0, y: 0 },
    data: { type, fields: {}, ...extra },
  };
}

describe("getGraphOutputStatus", () => {
  it("reports wired Root node", () => {
    const nodes = [node("a", "Sum"), node("r", "Root")];
    const edges: Edge[] = [{ id: "e1", source: "a", target: "r" }];
    const status = getGraphOutputStatus(nodes, edges, null, identity);
    expect(status?.label).toBe("Root: Sum");
    expect(status?.warning).toBe(false);
  });

  it("uses outputNodeId when Root node is absent (biome terrain)", () => {
    const nodes = [node("terrain", "SimplexNoise2D", { _outputNode: true })];
    const status = getGraphOutputStatus(nodes, [], "terrain", identity);
    expect(status?.label).toBe("Output: SimplexNoise2D");
    expect(status?.warning).toBe(false);
  });

  it("falls back to terminal density node for preview", () => {
    const nodes = [node("a", "Constant"), node("b", "Sum")];
    const edges: Edge[] = [{ id: "e1", source: "a", target: "b" }];
    const status = getGraphOutputStatus(nodes, edges, null, identity);
    expect(status?.label).toBe("Preview: Sum");
    expect(status?.warning).toBe(false);
  });

  it("warns when no output can be resolved", () => {
    const status = getGraphOutputStatus([], [], null, identity);
    expect(status?.label).toBe("Root missing");
    expect(status?.warning).toBe(true);
  });
});
