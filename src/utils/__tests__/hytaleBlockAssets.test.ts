import { describe, it, expect } from "vitest";
import { parseBlockyModel } from "../hytaleBlockAssets/parseBlockyModel";
import { inferCategory, categoryColor } from "../hytaleBlockAssets/inferCategory";
import { applyBlockRotation } from "../hytaleBlockAssets/applyBlockRotation";
import { resolveTextureName } from "../hytaleBlockAssets/resolveTextureName";
import { resolveBlockModel } from "../hytaleBlockAssets/resolveBlockModel";
import type { BlockAssetIndex } from "../hytaleBlockAssets/types";

describe("parseBlockyModel", () => {
  it("parses a single box node scaled by 1/32", () => {
    const boxes = parseBlockyModel({
      nodes: [{
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        shape: { settings: { size: { x: 32, y: 32, z: 32 } } },
      }],
    });
    expect(boxes).toHaveLength(1);
    expect(boxes![0].size).toEqual([1, 1, 1]);
  });
});

describe("inferCategory", () => {
  it("classifies stairs and soil blocks", () => {
    expect(inferCategory("Rock_Stone_Brick_Stairs")).toBe("stairs");
    expect(inferCategory("Soil_Grass")).toBe("solid_soil");
  });

  it("returns a color for every inferred category", () => {
    expect(categoryColor(inferCategory("Rock_Stone"))).toBeTypeOf("number");
  });
});

describe("applyBlockRotation", () => {
  it("maps rotation code 1 to -90deg on Y", () => {
    expect(applyBlockRotation(1).y).toBeCloseTo(-Math.PI / 2);
  });
});

describe("resolveTextureName", () => {
  const textureIndex = {
    rock_stone: "Rock_Stone.png",
    rock_stone_brick: "Rock_Stone_Brick.png",
  };

  it("strips shape suffixes", () => {
    expect(resolveTextureName("Rock_Stone_Brick_Stairs", textureIndex)).toBe("Rock_Stone_Brick.png");
  });
});

describe("resolveBlockModel", () => {
  const index: BlockAssetIndex = {
    textureIndex: { deco_bone_pile: "Deco_Bone_Pile.png" },
    modelIndex: {
      deco_bone_pile: [{
        relPath: "Decorations/Deco_Bone_Pile.blockymodel",
        absPath: "/cache/Common/Blocks/Decorations/Deco_Bone_Pile.blockymodel",
      }],
    },
    modelTexIndex: {},
    decoThemes: {},
  };

  it("resolves a direct basename match", () => {
    const boxes = [{ pos: [0, 0, 0] as [number, number, number], size: [1, 1, 1] as [number, number, number], quat: [0, 0, 0, 1] as [number, number, number, number] }];
    const result = resolveBlockModel("Deco_Bone_Pile", index, () => boxes);
    expect(result?.modelPath).toBe("Decorations/Deco_Bone_Pile.blockymodel");
    expect(result?.boxes).toHaveLength(1);
    expect(result?.blockTexture).toBe("bt:Deco_Bone_Pile.png");
  });
});
