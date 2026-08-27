import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { evaluateVectorProvider, ZERO_VEC3 } from "@/utils/vectorEvaluator";

/** Minimal graph plumbing: nodes by id, plus targetHandle -> sourceId edges. */
function graph(nodes: Record<string, { type: string; fields?: Record<string, unknown> }>,
               edges: Record<string, Record<string, string>> = {}) {
  const nodeById = new Map<string, Node>();
  for (const [id, n] of Object.entries(nodes)) {
    nodeById.set(id, { id, position: { x: 0, y: 0 }, data: { type: n.type, fields: n.fields ?? {} } } as Node);
  }
  const inputEdges = new Map<string, Map<string, string>>();
  for (const [target, handles] of Object.entries(edges)) {
    inputEdges.set(target, new Map(Object.entries(handles)));
  }
  return { nodeById, inputEdges };
}

const noDensity = () => 0;

describe("Constant vector provider", () => {
  it("reads V2's uppercase Vector shape", () => {
    // The exact shape shipped in Hytale assets.
    const g = graph({ c: { type: "Constant", fields: { Vector: { X: 30, Y: 0, Z: 0 } } } });
    expect(evaluateVectorProvider("c", 0, 0, 0, g.nodeById, g.inputEdges, noDensity))
      .toEqual({ x: 30, y: 0, z: 0 });
  });

  it("preserves a genuine zero vector", () => {
    // Six shipped constants are exactly (0,0,0); `||` defaulting would have
    // turned these into the (0,1,0) fallback.
    const g = graph({ c: { type: "Constant", fields: { Vector: { X: 0, Y: 0, Z: 0 } } } });
    expect(evaluateVectorProvider("c", 0, 0, 0, g.nodeById, g.inputEdges, noDensity))
      .toEqual(ZERO_VEC3);
  });

  it("handles negative components", () => {
    const g = graph({ c: { type: "Constant", fields: { Vector: { X: 0, Y: 0, Z: -15 } } } });
    expect(evaluateVectorProvider("c", 0, 0, 0, g.nodeById, g.inputEdges, noDensity))
      .toEqual({ x: 0, y: 0, z: -15 });
  });

  it("still accepts the older lowercase Value shape", () => {
    const g = graph({ c: { type: "Constant", fields: { Value: { x: 1, y: 2, z: 3 } } } });
    expect(evaluateVectorProvider("c", 0, 0, 0, g.nodeById, g.inputEdges, noDensity))
      .toEqual({ x: 1, y: 2, z: 3 });
  });

  it("falls back to up when no vector is given at all", () => {
    const g = graph({ c: { type: "Constant", fields: {} } });
    expect(evaluateVectorProvider("c", 0, 0, 0, g.nodeById, g.inputEdges, noDensity))
      .toEqual({ x: 0, y: 1, z: 0 });
  });
});

describe("ScalarMultiplier vector provider", () => {
  it("scales the vector by the density", () => {
    const g = graph(
      {
        m: { type: "ScalarMultiplier" },
        v: { type: "Constant", fields: { Vector: { X: 0, Y: 1, Z: 0 } } },
        s: { type: "Density" },
      },
      { m: { Vector: "v", Scalar: "s" } },
    );
    const density = (id: string) => (id === "s" ? 2.5 : 0);
    expect(evaluateVectorProvider("m", 0, 0, 0, g.nodeById, g.inputEdges, density))
      .toEqual({ x: 0, y: 2.5, z: 0 });
  });

  it("treats a missing scalar as 1 rather than collapsing the vector", () => {
    const g = graph(
      { m: { type: "ScalarMultiplier" }, v: { type: "Constant", fields: { Vector: { X: 3, Y: 0, Z: 0 } } } },
      { m: { Vector: "v" } },
    );
    expect(evaluateVectorProvider("m", 0, 0, 0, g.nodeById, g.inputEdges, noDensity))
      .toEqual({ x: 3, y: 0, z: 0 });
  });

  it("returns zero when no vector input is wired", () => {
    const g = graph({ m: { type: "ScalarMultiplier" } });
    expect(evaluateVectorProvider("m", 0, 0, 0, g.nodeById, g.inputEdges, noDensity))
      .toEqual(ZERO_VEC3);
  });
});
