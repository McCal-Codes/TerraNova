import { describe, it, expect } from "vitest";
import { createEvaluationContext } from "@/utils/densityEvaluator";
import { deriveNodeSeed } from "../javaRandom";
import fixture from "./fixtures/fbmParity.json";

/**
 * The node seed a graph actually uses.
 *
 * V2 resolves it through SeedBox: keys are concatenated down the tree and the result
 * is run through one FastRandom draw —
 * `new FastRandom((parentKey + nodeSeedKey).hashCode()).nextInt()`.
 *
 * TerraNova previously used the plain string hash, which produces a different world
 * for every seeded node. These pin the chain and the world-seed plumbing.
 */

const seedBox = fixture.seedBox as Array<{ chain: string[]; derived: number }>;

import type { Node, Edge } from "@xyflow/react";

function makeNode(id: string, type: string, fields: Record<string, unknown> = {}): Node {
  return { id, position: { x: 0, y: 0 }, data: { type, fields } };
}

function makeEdge(source: string, target: string, targetHandle?: string): Edge {
  return {
    id: `${source}-${target}-${targetHandle ?? ""}`,
    source,
    target,
    targetHandle: targetHandle ?? null,
  };
}

describe("world seed plumbing", () => {
  it("changes the field a node sees", () => {
    const nodes = [makeNode("n", "SimplexNoise2D", { Scale: 100, Octaves: 1, Seed: "A" })];
    const a = createEvaluationContext(nodes, [], "n", { worldSeed: "world-one" });
    const b = createEvaluationContext(nodes, [], "n", { worldSeed: "world-two" });

    const va = a!.evaluate("n", 12, 0, 34);
    const vb = b!.evaluate("n", 12, 0, 34);
    expect(va).not.toBe(vb);
  });

  it("is deterministic for the same world seed", () => {
    const nodes = [makeNode("n", "SimplexNoise2D", { Scale: 100, Octaves: 2, Seed: "A" })];
    const a = createEvaluationContext(nodes, [], "n", { worldSeed: "stable" });
    const b = createEvaluationContext(nodes, [], "n", { worldSeed: "stable" });
    expect(a!.evaluate("n", 7, 0, 9)).toBe(b!.evaluate("n", 7, 0, 9));
  });

  it("defaults to an empty root rather than skipping the derivation", () => {
    // An absent world seed still goes through SeedBox — it is SeedBox("" + key),
    // not the raw hash of the key.
    const nodes = [makeNode("n", "SimplexNoise2D", { Scale: 100, Octaves: 1, Seed: "A" })];
    const implicit = createEvaluationContext(nodes, [], "n");
    const explicit = createEvaluationContext(nodes, [], "n", { worldSeed: "" });
    expect(implicit!.evaluate("n", 3, 0, 5)).toBe(explicit!.evaluate("n", 3, 0, 5));
  });

  it("matches the jar's derivation for every recorded chain", () => {
    for (const { chain, derived } of seedBox) {
      expect(deriveNodeSeed(...chain), JSON.stringify(chain)).toBe(derived);
    }
  });

  it("treats a numeric Seed as SeedBox(int) does — Integer.toString then the chain", () => {
    expect(deriveNodeSeed("w", "42")).toBe(deriveNodeSeed("w", String(42)));
  });
});

describe("Switch / SwitchState use integers, not seeds", () => {
  /**
   * Regression: both handlers ran their values through hashSeed, which only worked
   * because the old helper passed numbers through unchanged. hashSeed is a seed
   * derivation; V2 compares Context.switchState as a plain int.
   */

  it("Switch matches the default state 0 against SwitchCases", () => {
    const nodes = [
      makeNode("sw", "Switch", { SwitchCases: [0] }),
      makeNode("a", "Constant", { Value: 42 }),
    ];
    const edges = [makeEdge("a", "sw", "Inputs[0]")];
    const ctx = createEvaluationContext(nodes, edges, "sw");
    expect(ctx!.evaluate("sw", 0, 0, 0)).toBe(42);
  });

  it("still accepts the legacy SwitchStates spelling", () => {
    const nodes = [
      makeNode("sw", "Switch", { SwitchStates: [0] }),
      makeNode("a", "Constant", { Value: 7 }),
    ];
    const edges = [makeEdge("a", "sw", "Inputs[0]")];
    const ctx = createEvaluationContext(nodes, edges, "sw");
    expect(ctx!.evaluate("sw", 0, 0, 0)).toBe(7);
  });

  it("SwitchState selects a non-zero case", () => {
    const nodes = [
      makeNode("st", "SwitchState", { SwitchState: 2 }),
      makeNode("sw", "Switch", { SwitchCases: [0, 2] }),
      makeNode("a", "Constant", { Value: 1 }),
      makeNode("b", "Constant", { Value: 99 }),
    ];
    const edges = [
      makeEdge("sw", "st", "Input"),
      makeEdge("a", "sw", "Inputs[0]"),
      makeEdge("b", "sw", "Inputs[1]"),
    ];
    const ctx = createEvaluationContext(nodes, edges, "st");
    expect(ctx!.evaluate("st", 0, 0, 0)).toBe(99);
  });

  it("a large integer case is compared as an integer, not hashed", () => {
    const nodes = [
      makeNode("st", "SwitchState", { SwitchState: 123456 }),
      makeNode("sw", "Switch", { SwitchCases: [123456] }),
      makeNode("a", "Constant", { Value: 5 }),
    ];
    const edges = [
      makeEdge("sw", "st", "Input"),
      makeEdge("a", "sw", "Inputs[0]"),
    ];
    const ctx = createEvaluationContext(nodes, edges, "st");
    expect(ctx!.evaluate("st", 0, 0, 0)).toBe(5);
  });
});

describe("world seed invalidates the preview cache", () => {
  /**
   * Regression: threading worldSeed into evaluation is not enough — if it is absent
   * from the fingerprint, changing the seed reuses the cached result and the field
   * silently does nothing. Same trap as the void-view toggle.
   */
  it("changes the evaluation fingerprint", async () => {
    const { computeEvaluationFingerprint } = await import("@/utils/previewAutoFit");
    const nodes = [makeNode("n", "SimplexNoise2D", { Scale: 100, Seed: "A" })];
    const base = { nodes, edges: [], contentFields: { Base: 100 } };

    const a = computeEvaluationFingerprint({ ...base, worldSeed: "world-one" });
    const b = computeEvaluationFingerprint({ ...base, worldSeed: "world-two" });
    const none = computeEvaluationFingerprint(base);

    expect(a).not.toBe(b);
    expect(a).not.toBe(none);
    expect(computeEvaluationFingerprint({ ...base, worldSeed: "world-one" })).toBe(a);
  });
});
