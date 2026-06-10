import { describe, it, expect } from "vitest";
import {
  summarizeWeightedAssignmentEntry,
  summarizeAssignments,
  totalWeightedAssignmentWeight,
  weightedAssignmentChance,
  readColumnPrimarySolid,
  readColumnBlocks,
  readColumnBlockSolid,
  writeColumnBlocks,
  writeColumnBlockSolid,
  nextColumnBlockY,
  writeColumnPrimarySolid,
  readDelimiterAssignment,
  writeDelimiterAssignment,
  delimiterUsesAssignmentBands,
  delimiterUsesMaterialBands,
  isInternalMaterialFieldFunction,
  readFieldFunctionMaterialSolid,
  writeFieldFunctionMaterialSolid,
  summarizeMaterialNode,
  normalizeInlineAssignment,
} from "../weightedAssignmentSummary";

describe("weightedAssignmentSummary", () => {
  const redFlower = {
    Weight: 35,
    Assignments: {
      Type: "Constant",
      Prop: {
        Type: "Column",
        ColumnBlocks: [{ Y: 0, Material: { Solid: "Plant_Flower_Common_Red2" } }],
      },
    },
  };

  const yellowFlower = {
    Weight: 65,
    Assignments: {
      Type: "Constant",
      Prop: {
        Type: "Column",
        ColumnBlocks: [{ Y: 0, Material: { Solid: "Plant_Flower_Common_Yellow2" } }],
      },
    },
  };

  it("summarizes Column entries with block id", () => {
    expect(summarizeWeightedAssignmentEntry(redFlower)).toContain("Column");
    expect(summarizeWeightedAssignmentEntry(redFlower)).toContain("Plant_Flower_Common_Red2");
    expect(summarizeWeightedAssignmentEntry(redFlower)).toContain("Weight 35");
  });

  it("computes total weight and pick chance", () => {
    const entries = [redFlower, yellowFlower];
    expect(totalWeightedAssignmentWeight(entries)).toBe(100);
    expect(weightedAssignmentChance(35, 100)).toBeCloseTo(35);
    expect(weightedAssignmentChance(65, 100)).toBeCloseTo(65);
  });

  it("reads and writes primary Column solid", () => {
    expect(readColumnPrimarySolid(redFlower)).toBe("Plant_Flower_Common_Red2");
    const updated = writeColumnPrimarySolid(redFlower, "Plant_Flower_Common_Yellow2");
    expect(readColumnPrimarySolid(updated)).toBe("Plant_Flower_Common_Yellow2");
    expect(readColumnBlockSolid(readColumnBlocks(updated)[0])).toBe("Plant_Flower_Common_Yellow2");
  });

  it("reads and writes multi-block Column stacks", () => {
    const boneStack = {
      Weight: 1,
      Assignments: {
        Type: "Constant",
        Prop: {
          Type: "Column",
          ColumnBlocks: [
            { Y: 1, Material: { Solid: "Deco_Bone_Pile" } },
            { Y: 3, Material: { Solid: "Deco_Bone_Skulls" } },
          ],
        },
      },
    };
    const blocks = readColumnBlocks(boneStack);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].Y).toBe(1);
    expect(readColumnBlockSolid(blocks[1])).toBe("Deco_Bone_Skulls");
    expect(nextColumnBlockY(blocks)).toBe(4);

    const withExtra = writeColumnBlocks(boneStack, [
      ...blocks,
      { Y: 4, Material: { Solid: "Deco_Bone_Skulls" } },
    ]);
    expect(readColumnBlocks(withExtra)).toHaveLength(3);

    const patched = writeColumnBlockSolid(blocks[0], "Deco_Bone_Rib");
    expect(readColumnBlockSolid(patched)).toBe("Deco_Bone_Rib");
  });

  it("summarizes weighted assignments for delimiter headers", () => {
    const summary = summarizeAssignments({
      Type: "Weighted",
      SkipChance: 0.04,
      WeightedAssignments: [redFlower],
    });
    expect(summary).toContain("Weighted");
    expect(summary).toContain("skip 4%");
    expect(summary).toContain("Plant_Flower_Common_Red2");
  });

  it("reads Imported assignment delimiters from Assignments or Assignment key", () => {
    const withAssignments = {
      Min: 0.22,
      Max: 1,
      Assignments: {
        Type: "Imported",
        Name: "AutumnForest_Cathedral_Grass",
        $Comment: "Imported: Wide cathedral grass — cliff plateaus + gloom glades.",
      },
    };
    const withAssignment = {
      Min: 0.22,
      Assignments: undefined,
      Assignment: {
        Type: "Imported",
        Name: "AutumnForest_Cathedral_Grass",
      },
    };
    expect(readDelimiterAssignment(withAssignments)?.Name).toBe("AutumnForest_Cathedral_Grass");
    expect(readDelimiterAssignment(withAssignments)?._comment).toContain("cathedral grass");
    expect(readDelimiterAssignment(withAssignment)?.Name).toBe("AutumnForest_Cathedral_Grass");
    const rewritten = writeDelimiterAssignment(withAssignment, {
      Type: "Imported",
      Name: "AutumnForest_Grasses",
    });
    expect(rewritten.Assignment).toBeDefined();
    expect(rewritten.Assignments).toBeUndefined();
  });

  it("detects assignment-style delimiter bands", () => {
    expect(delimiterUsesAssignmentBands([
      { Min: 0.22, Max: 1, Assignments: { Type: "Imported", Name: "A" } },
    ])).toBe(true);
    expect(delimiterUsesAssignmentBands([
      { From: 0.5, To: 0.8, Material: { Type: "Constant", Material: { Solid: "Rock_Stone" } } },
    ])).toBe(false);
  });

  it("detects material-style delimiter bands", () => {
    expect(delimiterUsesMaterialBands([
      { From: 0, To: 25, Material: { Type: "Constant", Material: { Solid: "Rock_Stone" } } },
    ])).toBe(true);
    expect(delimiterUsesMaterialBands([
      { Min: 0.22, Max: 1, Assignments: { Type: "Imported", Name: "A" }, Material: {} },
    ])).toBe(false);
    expect(isInternalMaterialFieldFunction({
      Materials: [{ Type: "Constant", Material: { Solid: "Rock_Stone" } }],
      DelimiterRanges: [{ From: 0, To: 25 }],
    })).toBe(true);
  });

  it("reads and writes FieldFunction material solids", () => {
    const material = { Type: "Constant", Material: { Solid: "Soil_Dirt", Fluid: "" } };
    expect(readFieldFunctionMaterialSolid(material)).toBe("Soil_Dirt");
    expect(summarizeMaterialNode(material)).toContain("Soil_Dirt");
    const next = writeFieldFunctionMaterialSolid(material, "Rock_Stone");
    expect(readFieldFunctionMaterialSolid(next)).toBe("Rock_Stone");
  });

  it("normalizes inline assignment $Comment to _comment", () => {
    const next = normalizeInlineAssignment({
      Type: "Imported",
      Name: "AutumnForest_Cathedral_Grass",
      $Comment: "Wide cathedral grass",
    });
    expect(next._comment).toBe("Wide cathedral grass");
    expect("$Comment" in next).toBe(false);
  });

  it("summarizes prefab variants with count", () => {
    const entry = {
      Weight: 1,
      Assignments: {
        Type: "Constant",
        Prop: {
          Type: "Prefab",
          WeightedPrefabPaths: [
            { Path: "McCal/AutumnForest/Bones/Bone_Ring_001", Weight: 3 },
            { Path: "McCal/AutumnForest/Bones/Bone_Skull_001", Weight: 2 },
          ],
        },
      },
    };
    expect(summarizeWeightedAssignmentEntry(entry)).toContain("2 variants");
  });
});
