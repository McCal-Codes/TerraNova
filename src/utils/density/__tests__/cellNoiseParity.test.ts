import { describe, it, expect } from "vitest";
import { voronoiNoise2D } from "../voronoiNoise";
import fixture from "./fixtures/fbmParity.json";

/**
 * Cell noise parity against the real V2 CellNoiseField.
 *
 * STATUS: known-failing, skipped. Measured 2026-07-27 against pre-release
 * 0.6.0-pre.9.1 — divergence is ~100% for every CellularReturnType:
 *
 *   CellValue      707/720   Distance      720/720   Distance2     720/720
 *   Distance2Add   720/720   Distance2Sub  720/720   Distance2Mul  720/720
 *   Distance2Div   720/720
 *
 * voronoiNoise.ts is an independent Worley implementation, not a port of the
 * FastNoiseLite cellular path V2 actually uses. Closing the gap needs:
 *
 *   1. The jar-extracted lookup tables in ../fastNoiseLiteTables.ts. Do NOT
 *      transcribe these from upstream FastNoiseLite — Hypixel ships a modified
 *      fork.
 *   2. float32 arithmetic throughout — the expected values are visibly
 *      float32-quantised (e.g. -0.9539167881011963). Math.fround at each step,
 *      not just at the end. This is the most likely source of the divergence.
 *   3. EuclideanSq as the distance function: CellNoise2D/3D expose no
 *      DistanceFunction field, so FastNoiseLite's default applies.
 *   4. CellValue as the default return type, and remember that V2's `CellType`
 *      field IS the CellularReturnType.
 *
 * CORRECTION to an earlier version of this note: it claimed a `0.43701595`
 * cellular-jitter modifier taken from upstream FastNoiseLite. That constant does
 * not appear anywhere in Hytale's fork. The real jitter scale is 0.5, which
 * voronoiNoise.ts already uses — so jitter is NOT the divergence. The hash primes
 * (501125321, 1136930381) and the 4.656613e-10 CellValue scale also already match.
 * Verified against release 0.6.0 by reflection; see fastNoiseLiteTables.ts.
 *
 * Un-skip once voronoiNoise.ts is replaced by a real FastNoiseLite port.
 * Regenerate the fixture with tools/parity/generate.sh.
 */

const EPSILON = 1e-12;
const COORDS: number[] = fixture.coords;

interface CellCase {
  seed: number;
  scale: number;
  jitter: number;
  octaves: number;
  cellType: string;
  v2d: number[];
  v3d: number[];
}

const CELL_CASES: CellCase[] = (fixture as unknown as { cellCases: CellCase[] }).cellCases;

describe.skip("cell noise parity (blocked on a FastNoiseLite port)", () => {
  it("matches CellNoiseField.valueAt(x, z) for every CellularReturnType", () => {
    const failures: string[] = [];

    for (const c of CELL_CASES) {
      if (c.octaves !== 1) continue; // octave stacking is a separate concern
      const noise = voronoiNoise2D(() => 0, "Euclidean", c.jitter, c.cellType, "EuclideanSq", c.seed);
      let i = 0;
      for (const x of COORDS) {
        for (const z of COORDS) {
          const actual = noise(x / c.scale, z / c.scale);
          const delta = Math.abs(actual - c.v2d[i]);
          if (!(delta <= EPSILON)) {
            failures.push(
              `cellType=${c.cellType} seed=${c.seed} scale=${c.scale} jitter=${c.jitter} ` +
                `at (${x}, ${z}): expected ${c.v2d[i]}, got ${actual}`,
            );
          }
          i++;
        }
      }
    }

    expect(failures, failures.slice(0, 5).join("\n")).toHaveLength(0);
  });
});

/**
 * This part is NOT skipped: the fixture must stay well-formed even while the
 * implementation gap is open, otherwise the eventual fix has nothing to aim at.
 */
describe("cell noise fixture", () => {
  it("covers every CellularReturnType", () => {
    const seen = new Set(CELL_CASES.map((c) => c.cellType));
    for (const expected of [
      "CellValue",
      "Distance",
      "Distance2",
      "Distance2Add",
      "Distance2Sub",
      "Distance2Mul",
      "Distance2Div",
    ]) {
      expect(seen, `missing ${expected}`).toContain(expected);
    }
  });

  it("covers the V2 default jitter and a non-default", () => {
    const jitters = new Set(CELL_CASES.map((c) => c.jitter));
    expect(jitters).toContain(0.3); // V2 default
    expect(jitters.size).toBeGreaterThan(1);
  });

  it("has consistent sample counts", () => {
    for (const c of CELL_CASES) {
      expect(c.v2d).toHaveLength(COORDS.length * COORDS.length);
      expect(c.v3d).toHaveLength(COORDS.length);
    }
  });
});
