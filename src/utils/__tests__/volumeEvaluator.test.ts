import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { evaluateDensityVolume } from "@/utils/volumeEvaluator";

function makeNode(id: string, type: string, fields: Record<string, unknown> = {}): Node {
  return {
    id,
    type: "generic",
    position: { x: 0, y: 0 },
    data: { type, fields, label: type },
  };
}

describe("evaluateDensityVolume", () => {
  it("throws cancelled when shouldCancel returns true mid-eval", () => {
    const nodes = [
      makeNode("noise", "SimplexNoise3D", { Scale: 0.04 }),
    ];
    const edges: Edge[] = [];
    let calls = 0;

    expect(() => evaluateDensityVolume(
      nodes,
      edges,
      8,
      -16,
      16,
      0,
      64,
      16,
      "noise",
      {
        shouldCancel: () => {
          calls++;
          return calls > 2;
        },
      },
    )).toThrow("cancelled");
  });

  it("returns finite bounds for a simple graph", () => {
    const nodes = [makeNode("bh", "BaseHeight", { BaseHeightName: "Base" })];
    const volume = evaluateDensityVolume(
      nodes,
      [],
      4,
      -8,
      8,
      0,
      32,
      4,
      "bh",
      { contentFields: { Base: 16 } },
    );

    expect(volume.densities.length).toBe(4 * 4 * 4);
    expect(volume.maxValue).toBeGreaterThanOrEqual(volume.minValue);
    expect(Number.isFinite(volume.minValue)).toBe(true);
    expect(Number.isFinite(volume.maxValue)).toBe(true);
  });
});
