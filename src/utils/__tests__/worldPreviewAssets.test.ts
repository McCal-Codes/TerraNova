import { describe, expect, it } from "vitest";
import type { ChunkDataResponse } from "../ipc";
import { detectWaterLevel, isWaterBlockName, rgbToHex } from "../worldPreviewAssets";

describe("isWaterBlockName", () => {
  it("matches Hytale fluid water ids", () => {
    expect(isWaterBlockName("Fluid_Water")).toBe(true);
    expect(isWaterBlockName("Soil_Grass_Water")).toBe(true);
  });

  it("excludes lava", () => {
    expect(isWaterBlockName("Fluid_Lava")).toBe(false);
  });
});

describe("rgbToHex", () => {
  it("formats sRGB hex", () => {
    expect(rgbToHex([1, 0.5, 0])).toBe("#ff8000");
  });
});

describe("detectWaterLevel", () => {
  it("returns highest water block near surface", () => {
    const palette = { "1": "Rock_Stone", "2": "Fluid_Water" };
    const blocks = new Array(32 * 32 * 10).fill(0);
    const heightmap = new Array(32 * 32).fill(65);
    const chunk: ChunkDataResponse = {
      chunkX: 0,
      chunkZ: 0,
      yMin: 60,
      yMax: 70,
      sizeX: 32,
      sizeZ: 32,
      heightmap,
      blocks,
      dataSource: "save",
    };
    const yr = 10;
    const col = 0;
    const waterY = 64;
    blocks[col * yr + (waterY - chunk.yMin)] = 2;

    expect(detectWaterLevel([chunk], palette)).toBe(waterY);
  });

  it("returns null when palette has no water", () => {
    const chunk: ChunkDataResponse = {
      chunkX: 0,
      chunkZ: 0,
      yMin: 0,
      yMax: 10,
      sizeX: 32,
      sizeZ: 32,
      heightmap: new Array(32 * 32).fill(5),
      blocks: new Array(32 * 32 * 10).fill(0),
      dataSource: "save",
    };
    expect(detectWaterLevel([chunk], { "1": "Rock_Stone" })).toBeNull();
  });
});
