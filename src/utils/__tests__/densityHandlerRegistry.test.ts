import { describe, it, expect, afterEach } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import {
  clearRegisteredDensityHandlers,
  createEvaluationContext,
  evaluateDensityGrid,
  getEvalStatus,
  hasRegisteredDensityHandler,
  isKnownDensityType,
  registerDensityHandlers,
} from "@/utils/densityEvaluator";
import { EvalStatus } from "@/schema/types";

function node(id: string, type: string, fields: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { type, fields } };
}

function edge(id: string, source: string, target: string, targetHandle = "Input"): Edge {
  return { id, source, target, sourceHandle: "output", targetHandle };
}

afterEach(() => {
  clearRegisteredDensityHandlers();
});

describe("density handler registry", () => {
  it("evaluates a node type the core does not implement", () => {
    const nodes = [node("a", "TotallyMadeUpNode", { Value: 7 })];

    // Without a handler the unknown-type fallback yields 0, which is a real
    // density value and therefore silently wrong rather than obviously broken.
    const before = createEvaluationContext(nodes, [], "a");
    expect(before?.evaluate("a", 0, 0, 0)).toBe(0);

    registerDensityHandlers({
      TotallyMadeUpNode: (_ctx, fields) => Number(fields.Value ?? 0),
    });

    const after = createEvaluationContext(nodes, [], "a");
    expect(after?.evaluate("a", 0, 0, 0)).toBe(7);
  });

  it("gives the handler position, fields and wired inputs", () => {
    const nodes = [node("root", "Doubler"), node("src", "Constant", { Value: 4 })];
    const edges: Edge[] = [edge("e", "src", "root")];

    registerDensityHandlers({
      Doubler: (ctx, _fields, inputs, x, y, z) =>
        ctx.getInput(inputs, "Input", x, y, z) * 2 + x + y + z,
    });

    const ctx = createEvaluationContext(nodes, edges, "root");
    expect(ctx?.evaluate("root", 1, 2, 3)).toBe(4 * 2 + 1 + 2 + 3);
  });

  it("replaces a built-in handler, last registration winning", () => {
    const nodes = [node("c", "Constant", { Value: 5 })];
    expect(createEvaluationContext(nodes, [], "c")?.evaluate("c", 0, 0, 0)).toBe(5);

    registerDensityHandlers({ Constant: () => 99 });
    expect(createEvaluationContext(nodes, [], "c")?.evaluate("c", 0, 0, 0)).toBe(99);

    registerDensityHandlers({ Constant: () => 111 });
    expect(createEvaluationContext(nodes, [], "c")?.evaluate("c", 0, 0, 0)).toBe(111);
  });

  it("unregisters only the handlers a given call installed", () => {
    const dispose = registerDensityHandlers({ First: () => 1, Second: () => 2 });
    registerDensityHandlers({ Second: () => 22 });

    dispose();

    // `First` was ours, so it goes. `Second` was taken over by a later
    // registration, so removing ours must not delete the newer one.
    expect(hasRegisteredDensityHandler("First")).toBe(false);
    expect(hasRegisteredDensityHandler("Second")).toBe(true);
  });

  it("reports registered types as supported and known", () => {
    expect(isKnownDensityType("Graph")).toBe(false);
    expect(getEvalStatus("DistanceToBiomeEdge")).toBe(EvalStatus.Approximated);

    registerDensityHandlers({ Graph: () => 0, DistanceToBiomeEdge: () => 0 });

    expect(isKnownDensityType("Graph")).toBe(true);
    expect(getEvalStatus("Graph")).toBe(EvalStatus.Full);
    // A real implementation outranks the approximated list.
    expect(getEvalStatus("DistanceToBiomeEdge")).toBe(EvalStatus.Full);
  });

  it("applies to grid evaluation, not just single samples", () => {
    registerDensityHandlers({ RampOnX: (_ctx, _f, _i, x) => x });
    const result = evaluateDensityGrid([node("r", "RampOnX")], [], 3, -1, 1, 0, "r");
    expect(result.minValue).toBeCloseTo(-1, 9);
    expect(result.maxValue).toBeCloseTo(1, 9);
  });

  it("leaves built-ins untouched when nothing is registered", () => {
    const nodes = [node("c", "Constant", { Value: 3 })];
    expect(createEvaluationContext(nodes, [], "c")?.evaluate("c", 0, 0, 0)).toBe(3);
    expect(isKnownDensityType("Constant")).toBe(true);
    expect(isKnownDensityType("NotARealType")).toBe(false);
  });
});
