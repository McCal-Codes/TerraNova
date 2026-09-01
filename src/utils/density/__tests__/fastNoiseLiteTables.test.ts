import { describe, it, expect } from "vitest";
import {
  RAND_VECS_2D, RAND_VECS_3D, CELLULAR_JITTER,
  HASH_PRIME_X, HASH_PRIME_Y, CELL_VALUE_SCALE,
} from "../fastNoiseLiteTables";

/**
 * Integrity of the jar-extracted FastNoiseLite tables.
 *
 * These are inputs to the cell-noise port. Corrupting them would produce noise
 * that is subtly wrong everywhere rather than obviously broken, so shape and
 * normalisation are pinned.
 */
describe("FastNoiseLite tables", () => {
  it("has the expected shape", () => {
    expect(RAND_VECS_2D).toHaveLength(512);   // 256 x (x, y)
    expect(RAND_VECS_3D).toHaveLength(1024);  // 256 x (x, y, z, pad)
  });

  it("holds unit vectors", () => {
    for (let i = 0; i < RAND_VECS_2D.length; i += 2) {
      const len = Math.hypot(RAND_VECS_2D[i], RAND_VECS_2D[i + 1]);
      expect(len, `2D entry ${i / 2}`).toBeCloseTo(1, 5);
    }
    for (let i = 0; i < RAND_VECS_3D.length; i += 4) {
      const len = Math.hypot(RAND_VECS_3D[i], RAND_VECS_3D[i + 1], RAND_VECS_3D[i + 2]);
      expect(len, `3D entry ${i / 4}`).toBeCloseTo(1, 5);
      // Fourth lane is padding for SIMD-style indexing and must stay zero.
      expect(RAND_VECS_3D[i + 3], `3D pad ${i / 4}`).toBe(0);
    }
  });

  it("records the fork's constants, not upstream's", () => {
    // Upstream FastNoiseLite uses 0.43701595 here; Hytale's fork does not contain
    // that constant at all. Verified against release 0.6.0.
    expect(CELLULAR_JITTER).toBe(0.5);
    expect(HASH_PRIME_X).toBe(501125321);
    expect(HASH_PRIME_Y).toBe(1136930381);
    expect(CELL_VALUE_SCALE).toBeCloseTo(4.656613e-10, 20);
  });
});
