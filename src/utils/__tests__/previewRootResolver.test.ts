import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import {
  getRecommendedTerrainRoot,
  resolvePreviewRoot,
  resolvePreviewRootForEvaluation,
} from "@/utils/previewRootResolver";

function node(id: string, type: string, rfType = "default"): Node {
  return {
    id,
    type: rfType,
    position: { x: 0, y: 0 },
    data: { type, fields: {} },
  };
}

function edge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target };
}

describe("previewRootResolver", () => {
  it("prefers Root-wired density over outputNodeId", () => {
    const nodes = [
      node("noise", "SimplexNoise3D"),
      node("sum", "Sum"),
      node("root", "Root", "Root"),
    ];
    const edges = [edge("noise", "sum"), edge("sum", "root")];

    const recommended = getRecommendedTerrainRoot(nodes, edges, "noise");
    expect(recommended?.id).toBe("sum");
  });

  it("uses explicit selection when valid density", () => {
    const nodes = [
      node("noise", "SimplexNoise3D"),
      node("sum", "Sum"),
    ];
    const edges = [edge("noise", "sum")];

    const resolution = resolvePreviewRoot({
      nodes,
      edges,
      selectedPreviewNodeId: "noise",
      outputNodeId: "sum",
    });

    expect(resolution.nodeId).toBe("noise");
    expect(resolution.source).toBe("explicit-selection");
    expect(resolution.connectedToOutput).toBe(false);
    expect(resolution.warning).toBeTruthy();
  });

  it("falls back to output node when selection is missing or invalid", () => {
    const nodes = [
      node("noise", "SimplexNoise3D"),
      node("sum", "Sum"),
    ];
    const edges = [edge("noise", "sum")];

    const resolution = resolvePreviewRoot({
      nodes,
      edges,
      selectedPreviewNodeId: "deleted",
      outputNodeId: "sum",
    });

    expect(resolution.nodeId).toBe("sum");
    expect(resolution.source).toBe("output-node");
    expect(resolution.connectedToOutput).toBe(true);
  });

  it("infers terminal density when no output is designated", () => {
    const nodes = [
      node("noise", "SimplexNoise3D"),
      node("sum", "Sum"),
    ];
    const edges = [edge("noise", "sum")];

    const resolution = resolvePreviewRoot({ nodes, edges });
    expect(resolution.nodeId).toBe("sum");
    expect(resolution.source).toBe("inferred-root");
  });

  it("prefers Sum over Environment Constant on multi-terminal biome graphs", () => {
    const nodes = [
      node("noise", "SimplexNoise2D"),
      node("sum", "Sum"),
      node("env", "Constant"),
    ];
    (nodes[2]!.data as Record<string, unknown>)._biomeField = "EnvironmentProvider";
    const edges = [edge("noise", "sum")];

    const resolution = resolvePreviewRoot({ nodes, edges });
    expect(resolution.nodeId).toBe("sum");
    expect(resolution.nodeType).toBe("Sum");
  });

  it("honors explicit intermediate selection for evaluation", () => {
    const nodes = [
      node("noise", "SimplexNoise3D"),
      node("sum", "Sum"),
    ];
    const edges = [edge("noise", "sum")];
    const input = {
      nodes,
      edges,
      selectedPreviewNodeId: "noise",
      outputNodeId: "sum",
    };

    const resolution = resolvePreviewRootForEvaluation(input);
    expect(resolution.nodeId).toBe("noise");
    expect(resolution.source).toBe("explicit-selection");
    expect(resolution.connectedToOutput).toBe(false);
  });
});
