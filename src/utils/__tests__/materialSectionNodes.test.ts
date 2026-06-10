import { describe, expect, it } from "vitest";
import { normalizeMaterialSectionNodeTypes } from "../materialSectionNodes";

describe("normalizeMaterialSectionNodeTypes", () => {
  it("promotes bare Imported to Material:Imported", () => {
    const [fixed] = normalizeMaterialSectionNodeTypes([
      {
        id: "n1",
        type: "Imported",
        position: { x: 0, y: 0 },
        data: { type: "Imported", fields: { Name: "AutumnForest_Path_Network" } },
      },
    ]);

    expect(fixed.type).toBe("Material:Imported");
    expect((fixed.data as Record<string, unknown>).type).toBe("Imported");
  });

  it("leaves already-prefixed material nodes unchanged", () => {
    const input = [
      {
        id: "n1",
        type: "Material:Constant",
        position: { x: 0, y: 0 },
        data: { type: "Constant", fields: { Material: "stone" } },
      },
    ];
    expect(normalizeMaterialSectionNodeTypes(input)).toBe(input);
  });
});
