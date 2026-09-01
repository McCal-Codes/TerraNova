import { describe, expect, it } from "vitest";
import { compareChunkSolidity, formatParitySummary } from "@/utils/chunkParityDiff";
import type { ChunkDataResponse } from "@/utils/ipc";
import { SOLID_THRESHOLD } from "@/utils/voxelExtractor";

/**
 * Synthetic chunks only — no Bridge, no game, no save files. The comparison
 * logic is pure, so it can be pinned exactly rather than sampled.
 */

const AIR = 0;
const STONE = 1;

/** Chunk whose blocks are decided by a predicate over local coords. */
function chunk(
  solid: (lx: number, y: number, lz: number) => boolean,
  over: Partial<ChunkDataResponse> = {},
): ChunkDataResponse {
  const sizeX = 4;
  const sizeZ = 4;
  const yMin = 0;
  const yMax = 4;
  const yRange = yMax - yMin;
  const blocks = new Array(sizeX * sizeZ * yRange).fill(AIR);
  for (let y = yMin; y < yMax; y++) {
    for (let lz = 0; lz < sizeZ; lz++) {
      for (let lx = 0; lx < sizeX; lx++) {
        blocks[(lz * sizeX + lx) * yRange + (y - yMin)] = solid(lx, y, lz) ? STONE : AIR;
      }
    }
  }
  return {
    chunkX: 0, chunkZ: 0, yMin, yMax, sizeX, sizeZ,
    blocks, heightmap: [], dataSource: "save",
    ...over,
  } as ChunkDataResponse;
}

/** Density that is solid below `surfaceY`, matching the flat-ground chunk. */
const flatGround = (surfaceY: number) => (_x: number, y: number, _z: number) =>
  y < surfaceY ? SOLID_THRESHOLD + 1 : SOLID_THRESHOLD - 1;

describe("compareChunkSolidity", () => {
  it("reports a perfect match when the evaluator agrees everywhere", () => {
    const r = compareChunkSolidity(chunk((_lx, y) => y < 2), flatGround(2));
    expect(r.comparable).toBe(true);
    expect(r.mismatches).toBe(0);
    expect(r.matchRatio).toBe(1);
    expect(r.firstDivergence).toBeUndefined();
    expect(r.totalVoxels).toBe(4 * 4 * 4);
  });

  it("counts terrain we invent separately from terrain we miss", () => {
    // Game surface at y<2, we predict y<3 — one extra solid layer of 16 voxels.
    const r = compareChunkSolidity(chunk((_lx, y) => y < 2), flatGround(3));
    expect(r.mismatches).toBe(16);
    expect(r.extraSolid).toBe(16);
    expect(r.extraAir).toBe(0);
  });

  it("reports the lowest divergence, not an arbitrary one", () => {
    // Disagree only at y=1: game solid, we say air.
    const r = compareChunkSolidity(
      chunk((_lx, y) => y < 3),
      (_x, y) => (y !== 1 && y < 3 ? SOLID_THRESHOLD + 1 : SOLID_THRESHOLD - 1),
    );
    expect(r.firstDivergence?.y).toBe(1);
    expect(r.firstDivergence?.game).toBe("solid");
    expect(r.firstDivergence?.local).toBe("air");
    expect(r.extraAir).toBe(16);
  });

  it("refuses to judge a synthetic chunk", () => {
    // The sidecar fabricates terrain when a chunk is not on disk; diffing
    // against invented ground would report nonsense with total confidence.
    const r = compareChunkSolidity(
      chunk((_lx, y) => y < 2, { dataSource: "synthetic" }),
      flatGround(2),
    );
    expect(r.comparable).toBe(false);
    expect(r.reason).toMatch(/not been generated/i);
    expect(r.mismatches).toBe(0);
  });

  it("refuses to judge a truncated chunk rather than reading past the end", () => {
    const c = chunk((_lx, y) => y < 2);
    c.blocks = c.blocks.slice(0, 10);
    const r = compareChunkSolidity(c, flatGround(2));
    expect(r.comparable).toBe(false);
    expect(r.reason).toMatch(/incomplete/i);
  });

  it("passes true world coordinates to the evaluator, not local ones", () => {
    const seen: number[] = [];
    compareChunkSolidity(
      chunk(() => false, { chunkX: 2, chunkZ: -1 }),
      (x, _y, z) => { seen.push(x, z); return SOLID_THRESHOLD - 1; },
    );
    // chunkX 2 * sizeX 4 => x starts at 8; chunkZ -1 => z starts at -4.
    expect(Math.min(...seen.filter((_, i) => i % 2 === 0))).toBe(8);
    expect(Math.min(...seen.filter((_, i) => i % 2 === 1))).toBe(-4);
  });
});

describe("formatParitySummary", () => {
  it("states an exact match plainly", () => {
    const r = compareChunkSolidity(chunk((_lx, y) => y < 2), flatGround(2));
    expect(formatParitySummary(r)).toMatch(/matches the game exactly/);
  });

  it("leads with the percentage and names the lowest divergence", () => {
    const r = compareChunkSolidity(chunk((_lx, y) => y < 2), flatGround(3));
    const s = formatParitySummary(r);
    expect(s).toMatch(/75\.00% match/);
    expect(s).toMatch(/lowest at \(0, 2, 0\)/);
  });

  it("surfaces the reason when a chunk cannot be judged", () => {
    const r = compareChunkSolidity(
      chunk(() => true, { dataSource: "synthetic" }),
      flatGround(2),
    );
    expect(formatParitySummary(r)).toMatch(/not been generated/i);
  });
});
