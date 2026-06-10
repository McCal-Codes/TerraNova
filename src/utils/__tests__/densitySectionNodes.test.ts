import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { getConstraints } from "@/schema/constraints";
import { validateFields } from "@/schema/validation";
import {
  isDensityConstantNode,
  normalizeDensitySectionNodeTypes,
  resolveDensityDiagnosticsTypeKey,
} from "@/utils/densitySectionNodes";
import { analyzeGraph } from "@/utils/graphDiagnostics";

function makeNode(
  id: string,
  rfType: string,
  bareType: string,
  fields: Record<string, unknown>,
): Node {
  return {
    id,
    type: rfType,
    position: { x: 0, y: 0 },
    data: { type: bareType, fields },
  };
}

describe("densitySectionNodes", () => {
  it("detects mis-prefixed density constant nodes", () => {
    const node = makeNode("c1", "Tint:Constant", "Constant", { Value: 0.26 });
    expect(isDensityConstantNode(node)).toBe(true);
    expect(resolveDensityDiagnosticsTypeKey(node)).toBe("Constant");
  });

  it("does not require Tint on density constants", () => {
    const node = makeNode("c1", "Tint:Constant", "Constant", { Value: 0.26 });
    const typeKey = resolveDensityDiagnosticsTypeKey(node);
    const constraints = { ...getConstraints(typeKey)! };
    delete constraints.Tint;
    delete constraints.Color;
    expect(validateFields(node.data.fields as Record<string, unknown>, constraints)).toHaveLength(0);
  });

  it("suppresses false constraints on legacy mis-prefixed nodes without normalize", () => {
    const nodes = [
      makeNode("c1", "Tint:Constant", "Constant", { Value: 0.26 }),
      makeNode("bh1", "Position:BaseHeight", "BaseHeight", { BaseHeightName: "Base", Distance: true }),
    ];
    const diagnostics = analyzeGraph(nodes, [], null);
    expect(diagnostics.filter((d) => d.code === "field-constraint")).toHaveLength(0);
    expect(diagnostics.filter((d) => d.message.includes("disconnected"))).toHaveLength(0);
    expect(diagnostics.filter((d) => d.message.includes("TintProvider → Curve"))).toHaveLength(0);
  });

  it("normalizes legacy terrain node types in place", () => {
    const nodes = [
      makeNode("c1", "Tint:Constant", "Constant", { Value: 0.26 }),
      makeNode("bh1", "Position:BaseHeight", "BaseHeight", { BaseHeightName: "Base", Distance: true }),
    ];
    const normalized = normalizeDensitySectionNodeTypes(nodes);
    expect(normalized[0].type).toBe("Constant");
    expect(normalized[1].type).toBe("BaseHeight");
    expect(analyzeGraph(normalized, [], null).filter((d) => d.code === "field-constraint")).toHaveLength(0);
  });
});
