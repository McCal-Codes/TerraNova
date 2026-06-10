import { describe, expect, it } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { computeEvaluationFingerprint } from "@/utils/previewAutoFit";

const graphNode: Node = {
  id: "n1",
  type: "Sum",
  position: { x: 0, y: 0 },
  data: { type: "Sum", fields: { A: 1 } },
};

const frameNode: Node = {
  id: "f1",
  type: "frame",
  position: { x: 10, y: 20 },
  data: { type: "frame", name: "Terrain", width: 300, height: 200 },
};

const edges: Edge[] = [];

describe("computeEvaluationFingerprint", () => {
  it("is unchanged when only canvas layout moves", () => {
    const base = computeEvaluationFingerprint({
      nodes: [graphNode, frameNode],
      edges,
    });
    const moved = computeEvaluationFingerprint({
      nodes: [
        { ...graphNode, position: { x: 400, y: 500 } },
        { ...frameNode, position: { x: 99, y: 88 }, data: { ...frameNode.data, width: 900, height: 600 } },
      ],
      edges,
    });
    expect(moved).toBe(base);
  });

  it("is unchanged when only annotations are added or resized", () => {
    const graphOnly = computeEvaluationFingerprint({ nodes: [graphNode], edges });
    const withFrame = computeEvaluationFingerprint({ nodes: [graphNode, frameNode], edges });
    const resizedFrame = computeEvaluationFingerprint({
      nodes: [graphNode, { ...frameNode, data: { type: "frame", name: "Bigger", width: 900, height: 600 } }],
      edges,
    });
    expect(withFrame).toBe(graphOnly);
    expect(resizedFrame).toBe(graphOnly);
  });

  it("changes when graph fields or root change", () => {
    const base = computeEvaluationFingerprint({
      nodes: [graphNode],
      edges,
      rootNodeId: "n1",
    });
    const edited = computeEvaluationFingerprint({
      nodes: [{ ...graphNode, data: { type: "Sum", fields: { A: 2 } } }],
      edges,
      rootNodeId: "n1",
    });
    const otherRoot = computeEvaluationFingerprint({
      nodes: [graphNode],
      edges,
      rootNodeId: "other",
    });
    expect(edited).not.toBe(base);
    expect(otherRoot).not.toBe(base);
  });
});
