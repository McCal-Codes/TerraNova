import { describe, it, expect } from "vitest";
import { hytaleToInternal } from "../hytaleToInternal";
import { internalToHytale } from "../internalToHytale";
import {
  mergeColumnPropFields,
  readPropColumnBlocks,
  writePropColumnBlocks,
} from "../columnPropHelpers";

describe("column prop round-trip", () => {
  const multiBlockHytale = {
    Type: "Column",
    Skip: false,
    ColumnBlocks: [
      { Y: 1, Material: { Solid: "Deco_Bone_Pile" } },
      { Y: 2, Material: { Solid: "Deco_Bone_Pile" } },
      { Y: 3, Material: { Solid: "Deco_Bone_Skulls" } },
    ],
    Scanner: {
      Type: "ColumnLinear",
      MinY: 48,
      MaxY: 92,
      ResultCap: 1,
      TopDownOrder: true,
    },
  };

  it("preserves multi-block ColumnBlocks on graph import", () => {
    const { asset: internal } = hytaleToInternal(multiBlockHytale);
    expect(internal.ColumnBlocks).toHaveLength(3);
    expect(internal.Height).toBeUndefined();
    expect(internal.Material).toBeUndefined();
    expect(readPropColumnBlocks(internal)).toHaveLength(3);
  });

  it("exports multi-block ColumnBlocks back to Hytale", () => {
    const { asset: internal } = hytaleToInternal(multiBlockHytale);
    const exported = internalToHytale({ Type: "Column", ...internal });
    const blocks = exported.ColumnBlocks as Array<{ Y?: number }>;
    expect(blocks).toHaveLength(3);
    expect(blocks[2].Y).toBe(3);
  });

  it("collapses single-block columns to Height/Material internally", () => {
    const single = {
      Type: "Column",
      ColumnBlocks: [{ Y: 0, Material: { Solid: "Plant_Grass" } }],
    };
    const { asset: internal } = hytaleToInternal(single);
    expect(internal.Height).toBe(0);
    expect(internal.Material).toBe("Plant_Grass");
    expect(internal.ColumnBlocks).toBeUndefined();
  });

  it("mergeColumnPropFields drops conflicting keys", () => {
    const existing = { Type: "Column", Height: 0, Material: "Plant_Grass" };
    const withStack = writePropColumnBlocks(existing, [
      { Y: 1, Material: { Solid: "A" } },
      { Y: 2, Material: { Solid: "B" } },
    ]);
    const merged = mergeColumnPropFields(existing, withStack);
    expect(merged.ColumnBlocks).toHaveLength(2);
    expect(merged.Height).toBeUndefined();
    expect(merged.Material).toBeUndefined();
  });
});
