import { describe, expect, it } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { createEvaluationContext } from "@/utils/density/evalContext";

/**
 * Fast, isolated harness for MultiMix's keyed (Hytale-native) form.
 *
 * Deliberately synthetic: four Constant densities and a Constant selector, so a
 * single evaluation is microseconds. Debugging this against a real biome meant
 * minutes per attempt and told you nothing about *why* — this tells you the
 * value and the evaluation count directly.
 */

function node(id: string, type: string, fields: Record<string, unknown> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: { type, fields } } as Node;
}
function edge(source: string, target: string, handle: string): Edge {
  return { id: `${source}->${target}:${handle}`, source, target, targetHandle: handle } as Edge;
}

/** Keyed MultiMix: Inputs[0..2] are densities, Inputs[3] is the selector. */
function keyedGraph(selectorValue: number) {
  const nodes = [
    node("mm", "MultiMix", {
      Keys: [
        { Value: -1, DensityIndex: 0 },
        { Value: 0, DensityIndex: 1 },
        { Value: 1, DensityIndex: 2 },
      ],
    }),
    node("d0", "Constant", { Value: 0 }),
    node("d1", "Constant", { Value: 100 }),
    node("d2", "Constant", { Value: 200 }),
    node("sel", "Constant", { Value: selectorValue }),
  ];
  const edges = [
    edge("d0", "mm", "Inputs[0]"),
    edge("d1", "mm", "Inputs[1]"),
    edge("d2", "mm", "Inputs[2]"),
    edge("sel", "mm", "Inputs[3]"),
  ];
  return { nodes, edges };
}

function evalMultiMix(selectorValue: number): number {
  const { nodes, edges } = keyedGraph(selectorValue);
  const ctx = createEvaluationContext(nodes, edges, "mm", {});
  if (!ctx) throw new Error("no context");
  return ctx.evaluate(ctx.rootId, 0, 0, 0);
}

describe("MultiMix — keyed (Hytale native) form", () => {
  it("selects the lowest key when the selector is at or below it", () => {
    expect(evalMultiMix(-1)).toBe(0);
    expect(evalMultiMix(-5)).toBe(0);
  });

  it("selects the highest key when the selector is at or above it", () => {
    expect(evalMultiMix(1)).toBe(200);
    expect(evalMultiMix(5)).toBe(200);
  });

  it("returns the exact density when the selector lands on a key", () => {
    expect(evalMultiMix(0)).toBe(100);
  });

  it("interpolates linearly between bracketing keys", () => {
    // halfway between key -1 (density 0) and key 0 (density 100)
    expect(evalMultiMix(-0.5)).toBeCloseTo(50);
    // quarter of the way from key 0 (100) to key 1 (200)
    expect(evalMultiMix(0.25)).toBeCloseTo(125);
  });

  it("is not NaN — the regression this whole harness exists for", () => {
    expect(Number.isFinite(evalMultiMix(0.5))).toBe(true);
  });
});

/**
 * Import-only checks. No density evaluation, so these run in microseconds and
 * isolate wiring from math — the distinction that was invisible when debugging
 * against a whole biome.
 */
describe("MultiMix — import wiring", () => {
  it("keeps all N inputs positional for the keyed form", async () => {
    const { hytaleToInternal } = await import("@/utils/hytaleToInternal");
    const { asset } = hytaleToInternal({
      $NodeId: "MultiMix.Density-1",
      Type: "MultiMix",
      Inputs: [
        { $NodeId: "a", Type: "Constant", Value: 0, Skip: false },
        { $NodeId: "b", Type: "Constant", Value: 1, Skip: false },
        { $NodeId: "c", Type: "Constant", Value: 2, Skip: false },
        { $NodeId: "d", Type: "Constant", Value: 3, Skip: false },
      ],
      Keys: [
        { Value: -1, DensityIndex: 0 },
        { Value: 0, DensityIndex: 1 },
        { Value: 1, DensityIndex: 2 },
      ],
      Skip: false,
    });
    // The keyed form must NOT be squeezed into InputA/InputB/Factor: doing so
    // drops the fourth input (the selector) entirely.
    expect(asset.InputA, "keyed MultiMix must not use named handles").toBeUndefined();
    expect(Array.isArray(asset.Inputs)).toBe(true);
    expect((asset.Inputs as unknown[]).length).toBe(4);
  });

  it("still uses named handles for the BlendCurve-shaped form", async () => {
    const { hytaleToInternal } = await import("@/utils/hytaleToInternal");
    const { asset } = hytaleToInternal({
      $NodeId: "MultiMix.Density-2",
      Type: "MultiMix",
      Inputs: [
        { $NodeId: "a", Type: "Constant", Value: 0, Skip: false },
        { $NodeId: "b", Type: "Constant", Value: 1, Skip: false },
        { $NodeId: "c", Type: "Constant", Value: 0.5, Skip: false },
      ],
      Curve: { Type: "Manual", Points: [{ $NodeId: "p1", In: 0, Out: 0 }] },
      Skip: false,
    });
    expect(asset.InputA).toBeDefined();
    expect(asset.Inputs).toBeUndefined();
  });
});

/**
 * The real shipped asset, through the real loader, checking wiring only.
 *
 * Synthetic imports above pass while this historically did not: the difference
 * is that a real MultiMix sits nested inside Terrain.Density and is reached by
 * a different code path than a top-level asset.
 */
describe("MultiMix — real shipped asset wiring", () => {
  it("wires every input of Example_Multi_Mixer_Horizontal positionally", async () => {
    const { resolveHytaleCacheRoot, loadBiomeJsonSync, buildHytaleTerrainSetup } =
      await import("@/dev/hytalePreviewSmokeLoader");
    const { getNodeType } = await import("@/utils/density/evalTypes");
    const root = resolveHytaleCacheRoot();
    if (!root) return; // no synced cache on this machine

    const rel = "Server/HytaleGenerator/Biomes/Examples/Example_Multi_Mixer_Horizontal.json";
    const setup = buildHytaleTerrainSetup(loadBiomeJsonSync(root, rel), root, rel);
    const mm = setup.nodes.find((n) => getNodeType(n) === "MultiMix");
    expect(mm, "graph should contain a MultiMix node").toBeDefined();

    const handles = setup.edges
      .filter((e) => e.target === mm!.id)
      .map((e) => e.targetHandle)
      .sort();
    expect(handles).toEqual(["Inputs[0]", "Inputs[1]", "Inputs[2]", "Inputs[3]"]);
  });
});

/**
 * Cost guard.
 *
 * Wiring MultiMix correctly means its inputs actually evaluate for the first
 * time — previously they resolved to nothing and returned NaN immediately, so
 * some slowdown is real work appearing, not a regression. This pins the cost so
 * that "real work" cannot quietly become "pathological": a 32x32 grid over a
 * shipped MultiMix graph is a trivial amount of sampling.
 */
describe("MultiMix — evaluation cost", () => {
  it("evaluates a shipped MultiMix graph within a sane budget", async () => {
    const { resolveHytaleCacheRoot, loadBiomeJsonSync, buildHytaleTerrainSetup } =
      await import("@/dev/hytalePreviewSmokeLoader");
    const { evaluateDensityGrid } = await import("@/utils/density/evaluateGrid");
    const root = resolveHytaleCacheRoot();
    if (!root) return;

    const rel = "Server/HytaleGenerator/Biomes/Examples/Example_Multi_Mixer_Horizontal.json";
    const setup = buildHytaleTerrainSetup(loadBiomeJsonSync(root, rel), root, rel);
    expect(setup.outputNodeId).toBeTruthy();

    const started = Date.now();
    const grid = evaluateDensityGrid(setup.nodes, setup.edges, 32, -200, 200, 64, setup.outputNodeId!, {
      contentFields: setup.contentFields,
      externalDensityExports: setup.externalDensityExports,
    });
    const elapsed = Date.now() - started;

    let finite = 0;
    for (const v of grid.values) if (Number.isFinite(v)) finite++;
    expect(finite, "every sample should be finite").toBe(grid.values.length);
    expect(elapsed, `1024 samples took ${elapsed}ms`).toBeLessThan(2000);
  });
});
