import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { NODE_WIDTH } from "@/constants";
import {
  applySectionAnnotationPositions,
  applySectionHytalePositions,
  computeHytaleLayoutScale,
  computePositionCoverage,
  hytaleToCanvasPosition,
  restoreGlobalHytalePositions,
  VIEWPORT_MARGIN,
} from "../applyHytaleImportLayout";

describe("computeHytaleLayoutScale", () => {
  it("scales up when Hytale neighbors are tighter than TerraNova nodes", () => {
    const scale = computeHytaleLayoutScale([
      { x: 0, y: 0 },
      { x: 110, y: 0 },
      { x: 286, y: 0 },
    ]);
    expect(scale).toBeGreaterThan(1);
  });

  it("does not crush large biomes using the full-graph bbox", () => {
    const scale = computeHytaleLayoutScale([
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 40000, y: 50000 },
    ]);
    expect(scale).toBeGreaterThan(1);
    expect(scale).toBeLessThan(4);
  });
});

describe("applySectionHytalePositions", () => {
  const nodeA: Node = {
    id: "Min.Density-a",
    type: "Min",
    position: { x: 0, y: 0 },
    data: { type: "Min", fields: {} },
  };
  const nodeB: Node = {
    id: "Max.Density-b",
    type: "Max",
    position: { x: 0, y: 0 },
    data: { type: "Max", fields: {} },
  };

  const nodePositions = {
    "Min.Density-a": { x: 100, y: 200 },
    "Max.Density-b": { x: 400, y: 500 },
  };

  it("normalizes section positions to the viewport margin", () => {
    const result = applySectionHytalePositions([nodeA, nodeB], nodePositions);
    expect(result.usedHytaleLayout).toBe(true);
    expect(result.nodes[0].position).toEqual({ x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN });
  });

  it("preserves relative spacing after normalization", () => {
    const result = applySectionHytalePositions([nodeA, nodeB], nodePositions);
    const scale = result.offset.scale ?? 1;
    const dx = result.nodes[1].position.x - result.nodes[0].position.x;
    const dy = result.nodes[1].position.y - result.nodes[0].position.y;
    expect(dx).toBeCloseTo(300 * scale, 4);
    expect(dy).toBeCloseTo(300 * scale, 4);
  });

  it("keeps closest nodes from overlapping on wide-span layouts", () => {
    const spreadPositions = {
      "Min.Density-a": { x: 0, y: 0 },
      "Max.Density-b": { x: 120, y: 0 },
      "Clamp.Density-c": { x: 40000, y: 50000 },
    };
    const nodeC: Node = {
      id: "Clamp.Density-c",
      type: "Clamp",
      position: { x: 0, y: 0 },
      data: { type: "Clamp", fields: {} },
    };
    const result = applySectionHytalePositions([nodeA, nodeB, nodeC], spreadPositions);
    const close = result.nodes.find((n) => n.id === "Min.Density-a")!;
    const near = result.nodes.find((n) => n.id === "Max.Density-b")!;
    const gap = near.position.x - close.position.x;
    expect(gap).toBeGreaterThanOrEqual(NODE_WIDTH);
  });

  it("scopes coverage to nodes in the active section", () => {
    const sectionIds = new Set(["Min.Density-a"]);
    const result = applySectionHytalePositions([nodeA, nodeB], nodePositions, sectionIds);
    expect(result.coverage).toBe(1);
    expect(result.usedHytaleLayout).toBe(true);
    expect(result.nodes[0].position).toEqual({ x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN });
    expect(result.nodes[1].position).toEqual({ x: 0, y: 0 });
  });

  it("restores global coordinates on export", () => {
    const result = applySectionHytalePositions([nodeA], nodePositions);
    const restored = restoreGlobalHytalePositions(result.nodes, result.offset);
    expect(restored[0].position.x).toBeCloseTo(100, 4);
    expect(restored[0].position.y).toBeCloseTo(200, 4);
  });
});

describe("applySectionAnnotationPositions", () => {
  it("translates annotations by the graph transform without scaling small layouts", () => {
    const frame: Node = {
      id: "frame-1",
      type: "frame",
      position: { x: 50, y: 60 },
      data: { type: "frame", name: "Wall", width: 400, height: 300 },
    };
    const transform = {
      x: 100,
      y: 200,
      originX: 0,
      originY: 0,
      scale: 1,
    };
    const positioned = applySectionAnnotationPositions([frame], transform);
    expect(positioned[0].position).toEqual(
      hytaleToCanvasPosition(50, 60, transform),
    );
    expect((positioned[0].data as { width: number }).width).toBe(400);
  });

  it("scales annotation sizes when the graph layout is scaled", () => {
    const frame: Node = {
      id: "frame-1",
      type: "frame",
      position: { x: 0, y: 0 },
      data: { type: "frame", name: "Wall", width: 1000, height: 800 },
    };
    const transform = {
      x: 0,
      y: 0,
      originX: 0,
      originY: 0,
      scale: 2,
    };
    const positioned = applySectionAnnotationPositions([frame], transform);
    expect((positioned[0].data as { width: number }).width).toBe(2000);
    expect((positioned[0].data as { height: number }).height).toBe(1600);
  });
});

describe("computePositionCoverage", () => {
  it("reports matched fraction for scoped graph nodes", () => {
    const nodes: Node[] = [
      { id: "a", type: "Constant", position: { x: 0, y: 0 }, data: {} },
      { id: "b", type: "Constant", position: { x: 0, y: 0 }, data: {} },
    ];
    const coverage = computePositionCoverage(nodes, { a: { x: 1, y: 2 } }, new Set(["a"]));
    expect(coverage).toBe(1);
  });
});
