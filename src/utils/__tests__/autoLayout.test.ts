import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { autoLayoutSelected, LAYOUT_SPACING } from "../autoLayout";

describe("LAYOUT_SPACING", () => {
  it("uses wider dagre gaps in comfortable mode", () => {
    expect(LAYOUT_SPACING.comfortable.nodesep).toBeGreaterThan(LAYOUT_SPACING.default.nodesep);
    expect(LAYOUT_SPACING.comfortable.ranksep).toBeGreaterThan(LAYOUT_SPACING.default.ranksep);
  });
});

describe("autoLayoutSelected comfortable spacing", () => {
  const nodes: Node[] = [
    { id: "a", type: "Constant", position: { x: 0, y: 0 }, data: {} },
    { id: "b", type: "Sum", position: { x: 0, y: 0 }, data: {} },
    { id: "c", type: "Product", position: { x: 0, y: 0 }, data: {} },
  ];
  const edges: Edge[] = [
    { id: "a-b", source: "a", target: "b" },
    { id: "b-c", source: "b", target: "c" },
  ];
  const selectedIds = new Set(["a", "b", "c"]);

  function spanX(layouted: Node[]): number {
    const selected = layouted.filter((n) => selectedIds.has(n.id));
    const xs = selected.map((n) => n.position.x);
    return Math.max(...xs) - Math.min(...xs);
  }

  it("spreads the selection farther than the default preset", async () => {
    const defaultLayout = await autoLayoutSelected(nodes, edges, selectedIds, "LR", "default");
    const comfortableLayout = await autoLayoutSelected(nodes, edges, selectedIds, "LR", "comfortable");
    expect(spanX(comfortableLayout)).toBeGreaterThan(spanX(defaultLayout));
  });
});
