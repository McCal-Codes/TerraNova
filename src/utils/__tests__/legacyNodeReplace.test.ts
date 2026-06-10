import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import { applyLegacyNodeReplacement } from "@/utils/legacyNodeReplace";

function makeNode(typeKey: string, fields: Record<string, unknown> = {}): Node {
  const bare = typeKey.includes(":") ? typeKey.split(":")[1] : typeKey;
  return {
    id: "n1",
    type: typeKey,
    position: { x: 0, y: 0 },
    data: { type: bare, fields },
  };
}

describe("applyLegacyNodeReplacement", () => {
  it("maps Zero to Constant with Value 0", () => {
    const node = makeNode("Zero", { Skip: false });
    const next = applyLegacyNodeReplacement(node, "Zero", "Constant");
    expect(next.type).toBe("Constant");
    expect(next.data).toMatchObject({ type: "Constant", fields: { Skip: false, Value: 0 } });
  });

  it("maps One to Constant with Value 1", () => {
    const node = makeNode("One");
    const next = applyLegacyNodeReplacement(node, "One", "Constant");
    expect(next.data).toMatchObject({ type: "Constant", fields: { Value: 1 } });
  });

  it("maps Product to Multiplier preserving fields", () => {
    const node = makeNode("Product", { Skip: true });
    const next = applyLegacyNodeReplacement(node, "Product", "Multiplier");
    expect(next.type).toBe("Multiplier");
    expect(next.data).toMatchObject({ type: "Multiplier", fields: { Skip: true } });
  });

  it("maps Cache2D to Cache without field changes", () => {
    const node = makeNode("Cache2D", { Skip: false });
    const next = applyLegacyNodeReplacement(node, "Cache2D", "Cache");
    expect(next.type).toBe("Cache");
    expect(next.data).toMatchObject({ type: "Cache", fields: { Skip: false } });
  });

  it("maps Material layer thickness to Layer prefix preserving Thickness", () => {
    const node = makeNode("Material:ConstantThickness", { Thickness: 4 });
    const next = applyLegacyNodeReplacement(
      node,
      "Material:ConstantThickness",
      "Layer:ConstantThickness",
    );
    expect(next.type).toBe("Layer:ConstantThickness");
    expect(next.data).toMatchObject({
      type: "ConstantThickness",
      fields: { Thickness: 4 },
    });
  });

  it("maps LinearTransform to AmplitudeConstant preserving Scale", () => {
    const node = makeNode("LinearTransform", { Scale: 2, Offset: 0 });
    const next = applyLegacyNodeReplacement(node, "LinearTransform", "AmplitudeConstant");
    expect(next.type).toBe("AmplitudeConstant");
    expect(next.data).toMatchObject({
      type: "AmplitudeConstant",
      fields: { Scale: 2, Offset: 0 },
    });
  });
});
