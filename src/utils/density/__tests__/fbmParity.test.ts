import { describe, it, expect } from "vitest";
import { createHytaleNoise2D, createHytaleNoise3D } from "../../hytaleNoise";
import { fbm2D, fbm3D } from "../fbm";
import fixture from "./fixtures/fbmParity.json";

/**
 * Numeric parity against the real Hytale V2 noise implementation.
 *
 * The fixture is produced by tools/parity/Parity.java, which calls the actual
 * classes out of HytaleServer.jar. Regenerate with tools/parity/generate.sh.
 *
 * Two layers are checked independently so a failure localises:
 *
 *   simplex — raw Simplex.noise(): gradients, permutation table, skew constants.
 *   field   — SimplexNoiseField.valueAt(): seeded per-octave offsets, octave
 *             frequency/amplitude, and the 1/sum(amp) normalizer.
 *
 * If both fail, fix the core first: the field layer is built on top of it.
 */

interface ParityCase {
  seed: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  scale: number;
  v2d: number[];
  v3d: number[];
}

const COORDS: number[] = fixture.coords;
const CASES: ParityCase[] = fixture.cases as ParityCase[];

/**
 * Doubles are compared with a tight absolute tolerance rather than toBeCloseTo,
 * which works in decimal places and is too loose for values near zero.
 */
const EPSILON = 1e-12;

/**
 * Looser tolerance for the seeded octave field only.
 *
 * Update 6 improved SimplexNoise2D/3D performance by roughly 20%, which
 * reassociated the octave accumulation. The mathematics is unchanged — the raw
 * `Simplex.noise` core above still matches the jar to EPSILON — but summing the
 * same terms in a different order moves the last few ULPs.
 *
 * Regenerating fixtures against the Update 6 jar showed deltas from 3.5e-18 to
 * 1.4e-10, median 1.4e-14. Only the tail exceeds EPSILON. 1e-9 clears the
 * observed maximum with roughly 7x headroom while staying far tighter than
 * anything that could affect terrain: solidity is decided at a threshold of 0,
 * where a 1e-10 difference is invisible.
 *
 * Chasing bit-exactness here would mean mirroring the jar's new accumulation
 * order in fbm.ts for no visible gain. If that is ever done, drop this back to
 * EPSILON.
 */
const FIELD_EPSILON = 1e-9;

function expectClose(actual: number, expected: number, label: string): void {
  const delta = Math.abs(actual - expected);
  if (!(delta <= EPSILON)) {
    throw new Error(
      `${label}\n  expected: ${expected}\n  actual:   ${actual}\n  delta:    ${delta} (tolerance ${EPSILON})`,
    );
  }
}

describe("noise parity: raw simplex core", () => {
  it("matches Simplex.noise(x, y) from the V2 jar", () => {
    // The seed is irrelevant here: V2 uses a fixed permutation table.
    const noise2D = createHytaleNoise2D(0);
    let i = 0;
    for (const x of COORDS) {
      for (const z of COORDS) {
        expectClose(
          noise2D(x / 50.0, z / 50.0),
          fixture.simplex2d[i],
          `simplex2d at (${x}, ${z}) [index ${i}]`,
        );
        i++;
      }
    }
  });

  it("matches Simplex.noise(x, y, z) from the V2 jar", () => {
    const noise3D = createHytaleNoise3D(0);
    let i = 0;
    for (const x of COORDS) {
      for (const z of COORDS) {
        expectClose(
          noise3D(x / 50.0, z / 50.0, (x + z) / 100.0),
          fixture.simplex3d[i],
          `simplex3d at (${x}, ${z}) [index ${i}]`,
        );
        i++;
      }
    }
  });
});

describe("noise parity: seeded octave field", () => {
  it(`matches SimplexNoiseField.valueAt(x, z) across ${CASES.length} configurations`, () => {
    const failures: string[] = [];

    for (const c of CASES) {
      const noise2D = createHytaleNoise2D(c.seed);
      let i = 0;
      for (const x of COORDS) {
        for (const z of COORDS) {
          const actual = fbm2D(
            noise2D,
            x,
            z,
            c.scale,
            c.scale,
            c.octaves,
            c.lacunarity,
            c.persistence,
            c.seed,
          );
          const delta = Math.abs(actual - c.v2d[i]);
          if (!(delta <= FIELD_EPSILON)) {
            failures.push(
              `seed=${c.seed} octaves=${c.octaves} persistence=${c.persistence} ` +
                `lacunarity=${c.lacunarity} scale=${c.scale} at (${x}, ${z}): ` +
                `expected ${c.v2d[i]}, got ${actual} (delta ${delta}, tolerance ${FIELD_EPSILON})`,
            );
          }
          i++;
        }
      }
    }

    if (failures.length > 0) {
      const shown = failures.slice(0, 10).join("\n  ");
      throw new Error(
        `${failures.length} of ${CASES.length * COORDS.length * COORDS.length} 2D samples ` +
          `diverged from the V2 jar:\n  ${shown}` +
          (failures.length > 10 ? `\n  ...and ${failures.length - 10} more` : ""),
      );
    }
  });

  it(`matches SimplexNoiseField.valueAt(x, y, z) across ${CASES.length} configurations`, () => {
    const failures: string[] = [];

    for (const c of CASES) {
      const noise3D = createHytaleNoise3D(c.seed);
      let i = 0;
      for (const v of COORDS) {
        const actual = fbm3D(
          noise3D,
          v,
          v * 0.5,
          -v,
          c.scale,
          c.scale,
          c.octaves,
          c.lacunarity,
          c.persistence,
          c.seed,
          c.scale,
        );
        const delta = Math.abs(actual - c.v3d[i]);
        if (!(delta <= FIELD_EPSILON)) {
          failures.push(
            `seed=${c.seed} octaves=${c.octaves} persistence=${c.persistence} ` +
              `lacunarity=${c.lacunarity} scale=${c.scale} at (${v}, ${v * 0.5}, ${-v}): ` +
              `expected ${c.v3d[i]}, got ${actual} (delta ${delta}, tolerance ${FIELD_EPSILON})`,
          );
        }
        i++;
      }
    }

    if (failures.length > 0) {
      const shown = failures.slice(0, 10).join("\n  ");
      throw new Error(
        `${failures.length} of ${CASES.length * COORDS.length} 3D samples ` +
          `diverged from the V2 jar:\n  ${shown}` +
          (failures.length > 10 ? `\n  ...and ${failures.length - 10} more` : ""),
      );
    }
  });
});

describe("noise parity: fixture integrity", () => {
  it("has the expected shape", () => {
    expect(COORDS.length).toBeGreaterThan(0);
    expect(CASES.length).toBeGreaterThan(0);
    expect(fixture.simplex2d).toHaveLength(COORDS.length * COORDS.length);
    expect(fixture.simplex3d).toHaveLength(COORDS.length * COORDS.length);
    for (const c of CASES) {
      expect(c.v2d).toHaveLength(COORDS.length * COORDS.length);
      expect(c.v3d).toHaveLength(COORDS.length);
    }
  });

  it("covers multi-octave configurations, which is where offset drift shows up", () => {
    expect(CASES.some((c) => c.octaves >= 3)).toBe(true);
  });
});
