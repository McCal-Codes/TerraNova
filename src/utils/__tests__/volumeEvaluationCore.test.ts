import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import { progressiveYSlices, buildProgressiveVolumeSteps } from "@/utils/volumeEvaluationCore";
import { evaluateDensityVolumeSteps } from "@/utils/volumeEvaluator";

function makeNode(id: string, type: string): Node {
  return {
    id,
    type: "generic",
    position: { x: 0, y: 0 },
    data: { type, fields: { BaseHeightName: "Base" }, label: type },
  };
}

describe("progressiveYSlices", () => {
  it("caps coarse passes for speed", () => {
    expect(progressiveYSlices(128, 16, 128)).toBeLessThanOrEqual(12);
    expect(progressiveYSlices(128, 32, 128)).toBeLessThanOrEqual(32);
    expect(progressiveYSlices(128, 64, 128)).toBeLessThanOrEqual(64);
    expect(progressiveYSlices(128, 128, 128)).toBe(128);
  });

  it("scales proportionally at target resolution", () => {
    expect(progressiveYSlices(64, 64, 128)).toBe(32);
  });
});

describe("buildProgressiveVolumeSteps", () => {
  it("returns a single pass when progressive is off", () => {
    const steps = buildProgressiveVolumeSteps(256, 96, false);
    expect(steps).toEqual([{ resolution: 256, ySlices: 96 }]);
  });

  it("builds coarse → mid → target ladder", () => {
    const steps = buildProgressiveVolumeSteps(256, 96, true);
    expect(steps.map((s) => s.resolution)).toEqual([16, 64, 256]);
    expect(steps[0].ySlices).toBeLessThanOrEqual(12);
  });

  it("skips redundant ladder when target is coarse", () => {
    expect(buildProgressiveVolumeSteps(16, 8, true)).toEqual([{ resolution: 16, ySlices: 8 }]);
  });
});

describe("evaluateDensityVolumeSteps", () => {
  it("produces one grid per step", () => {
    const nodes = [makeNode("bh", "BaseHeight")];
    const results = evaluateDensityVolumeSteps(
      nodes,
      [],
      "bh",
      { contentFields: { Base: 64 } },
      { rangeMin: -8, rangeMax: 8, yMin: 0, yMax: 32 },
      [{ resolution: 4, ySlices: 4 }, { resolution: 8, ySlices: 4 }],
    );
    expect(results).toHaveLength(2);
    expect(results[0].densities.length).toBe(4 * 4 * 4);
    expect(results[1].densities.length).toBe(8 * 8 * 4);
  });
});
