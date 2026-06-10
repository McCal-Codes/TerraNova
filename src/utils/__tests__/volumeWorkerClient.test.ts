import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Node } from "@xyflow/react";
import { createVolumeWorkerInstance } from "@/utils/volumeWorkerClient";

function makeNode(id: string, type: string): Node {
  return {
    id,
    type: "generic",
    position: { x: 0, y: 0 },
    data: { type, fields: { BaseHeightName: "Base" }, label: type },
  };
}

describe("volumeWorkerClient progressive", () => {
  const OriginalWorker = globalThis.Worker;

  beforeEach(() => {
    vi.stubGlobal("Worker", class {
      constructor() {
        throw new Error("Worker unavailable in test");
      }
    });
  });

  afterEach(() => {
    globalThis.Worker = OriginalWorker;
    vi.unstubAllGlobals();
  });

  it("runs all steps on main-thread fallback", async () => {
    const instance = createVolumeWorkerInstance();
    const nodes = [makeNode("bh", "BaseHeight")];
    const seenRes: number[] = [];

    await instance.evaluateProgressive(
      {
        sessionKey: "test",
        nodes,
        edges: [],
        rangeMin: -8,
        rangeMax: 8,
        yMin: 0,
        yMax: 32,
        rootNodeId: "bh",
        options: { contentFields: { Base: 64 } },
        steps: [
          { resolution: 4, ySlices: 4 },
          { resolution: 8, ySlices: 4 },
        ],
        pauseAfterFirst: false,
      },
      async (step) => {
        seenRes.push(step.resolution);
      },
    );

    expect(seenRes).toEqual([4, 8]);
  });

  it("stops after step 0 when onStep returns abort", async () => {
    const instance = createVolumeWorkerInstance();
    const nodes = [makeNode("bh", "BaseHeight")];
    const seenRes: number[] = [];

    await instance.evaluateProgressive(
      {
        sessionKey: "test-abort",
        nodes,
        edges: [],
        rangeMin: -8,
        rangeMax: 8,
        yMin: 0,
        yMax: 32,
        rootNodeId: "bh",
        options: { contentFields: { Base: 64 } },
        steps: [
          { resolution: 4, ySlices: 4 },
          { resolution: 8, ySlices: 4 },
        ],
        pauseAfterFirst: true,
      },
      async (step) => {
        seenRes.push(step.resolution);
        if (step.stepIndex === 0) return "abort";
      },
    );

    expect(seenRes).toEqual([4]);
  });

  it("abort resolves without throwing cancelled", async () => {
    const instance = createVolumeWorkerInstance();
    const nodes = [makeNode("bh", "BaseHeight")];

    await expect(instance.evaluateProgressive(
      {
        sessionKey: "test-abort-resolve",
        nodes,
        edges: [],
        rangeMin: -8,
        rangeMax: 8,
        yMin: 0,
        yMax: 32,
        rootNodeId: "bh",
        options: { contentFields: { Base: 64 } },
        steps: [{ resolution: 4, ySlices: 4 }],
        pauseAfterFirst: false,
      },
      async (): Promise<"abort"> => "abort",
    )).resolves.toBeUndefined();
  });
});
