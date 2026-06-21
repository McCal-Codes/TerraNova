import { describe, expect, it } from "vitest";
import { evaluateDensityGrid } from "@/utils/density/evaluateGrid";

describe("evaluateDensityGrid preview origin", () => {
  it("offsets sample coordinates via contentFields previewOriginX/Z", () => {
    const nodes = [
      {
        id: "const",
        type: "Constant",
        position: { x: 0, y: 0 },
        data: { type: "Constant", fields: { Value: 1 } },
      },
    ];
    const atOrigin = evaluateDensityGrid(nodes, [], 3, -1, 1, 0, "const", {
      contentFields: { previewOriginX: 0, previewOriginZ: 0 },
    });
    const offset = evaluateDensityGrid(nodes, [], 3, -1, 1, 0, "const", {
      contentFields: { previewOriginX: 100, previewOriginZ: 200 },
    });
    expect(atOrigin.values.every((v) => v === 1)).toBe(true);
    expect(offset.values.every((v) => v === 1)).toBe(true);
    expect(atOrigin.values).not.toBe(offset.values);
  });
});
