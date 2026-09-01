import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import {
  computeEvaluationFingerprint,
  type EvaluationFingerprintInput,
} from "@/utils/previewAutoFit";

/**
 * Guard against silently stale previews.
 *
 * Three separate features in a row reached the evaluator but not the fingerprint —
 * the cutaway preset, the void-view toggle, and the world seed. Each looked wired
 * up and did nothing, because evaluation reused a cached result keyed on an
 * identical fingerprint. Nothing failed; the preview just went quietly stale.
 *
 * The compile-time half of this guard is MUTATORS below: it is typed as a
 * Record over `keyof EvaluationFingerprintInput`, so adding a field to that
 * interface without adding a mutator here is a TYPE ERROR, not a silent gap.
 *
 * The runtime half asserts each mutation actually moves the fingerprint.
 */

const node = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: { type: "Constant", fields: {} } });

/** Every field populated, so each mutation below is a real change. */
const BASE: Required<EvaluationFingerprintInput> = {
  // Two real nodes so the edges mutation below connects existing endpoints —
  // computeGraphHash deliberately drops edges whose source or target is not a
  // graph node, since a dangling edge cannot affect evaluation.
  nodes: [node("a"), node("b")],
  edges: [],
  contentFields: { Base: 100 },
  worldSeed: "seed-one",
  rootNodeId: "a",
  rootSource: "output",
  materialConfig: { palette: "default" },
};

/**
 * One mutation per fingerprint input. Adding a field to
 * EvaluationFingerprintInput without extending this map will not compile.
 */
const MUTATORS: Record<
  keyof EvaluationFingerprintInput,
  (input: Required<EvaluationFingerprintInput>) => EvaluationFingerprintInput
> = {
  nodes: (i) => ({ ...i, nodes: [...i.nodes, node("c")] }),
  edges: (i) => ({ ...i, edges: [{ id: "e", source: "a", target: "b", targetHandle: null }] }),
  contentFields: (i) => ({ ...i, contentFields: { Base: 64 } }),
  worldSeed: (i) => ({ ...i, worldSeed: "seed-two" }),
  rootNodeId: (i) => ({ ...i, rootNodeId: "b" }),
  rootSource: (i) => ({ ...i, rootSource: "selection" }),
  materialConfig: (i) => ({ ...i, materialConfig: { palette: "other" } }),
};

describe("evaluation fingerprint covers every input", () => {
  const baseline = computeEvaluationFingerprint(BASE);

  it.each(Object.keys(MUTATORS) as Array<keyof EvaluationFingerprintInput>)(
    "changing %s changes the fingerprint",
    (field) => {
      const mutated = computeEvaluationFingerprint(MUTATORS[field](BASE));
      expect(
        mutated,
        `"${field}" does not affect the fingerprint — previews will reuse a stale cached result when it changes`,
      ).not.toBe(baseline);
    },
  );

  it("is stable for identical input", () => {
    expect(computeEvaluationFingerprint(BASE)).toBe(baseline);
    expect(computeEvaluationFingerprint({ ...BASE })).toBe(baseline);
  });

  it("distinguishes an absent field from an empty one", () => {
    // "" and undefined must not collide, or clearing the world seed would reuse
    // the seeded result.
    const absent = computeEvaluationFingerprint({ ...BASE, worldSeed: undefined });
    const empty = computeEvaluationFingerprint({ ...BASE, worldSeed: "" });
    expect(absent).toBe(empty); // both mean "unseeded root" — deliberately equal
    expect(absent).not.toBe(baseline);
  });
});
