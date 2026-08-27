import { describe, expect, it } from "vitest";
import { rngFieldGet3D, whiteNoise3D } from "@/utils/density/rngField";
import fixture from "./fixtures/whiteNoiseParity.json";

interface Case {
  seed: number;
  rngField: number[];
  density: number[];
}

const COORDS: number[] = fixture.coords;
const CASES: Case[] = fixture.cases as Case[];

/** Integers must match exactly; the density draw is an exact double too. */
const EPSILON = 0;

describe("white noise parity: positional hash", () => {
  it("matches RngField.get(x, y, z) from the V2 jar", () => {
    const failures: string[] = [];
    for (const c of CASES) {
      let i = 0;
      for (const x of COORDS) {
        for (const y of COORDS) {
          for (const z of COORDS) {
            const actual = rngFieldGet3D(c.seed, x, y, z);
            if (actual !== c.rngField[i]) {
              failures.push(
                `seed=${c.seed} at (${x}, ${y}, ${z}): expected ${c.rngField[i]}, got ${actual}`,
              );
            }
            i++;
          }
        }
      }
    }
    expect(failures.slice(0, 5).join("\n")).toBe("");
  });
});

describe("white noise parity: density node", () => {
  it("matches WhiteNoiseDensity.process() from the V2 jar", () => {
    const failures: string[] = [];
    for (const c of CASES) {
      let i = 0;
      for (const x of COORDS) {
        for (const y of COORDS) {
          for (const z of COORDS) {
            const actual = whiteNoise3D(c.seed, x, y, z);
            const delta = Math.abs(actual - c.density[i]);
            if (!(delta <= EPSILON)) {
              failures.push(
                `seed=${c.seed} at (${x}, ${y}, ${z}): expected ${c.density[i]}, got ${actual} (delta ${delta})`,
              );
            }
            i++;
          }
        }
      }
    }
    expect(failures.slice(0, 5).join("\n")).toBe("");
  });

  it("stays within [-1, 1] and is not degenerate", () => {
    const vals = CASES.flatMap((c) => c.density);
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...vals)).toBeLessThanOrEqual(1);
    expect(new Set(vals).size).toBeGreaterThan(vals.length / 2);
  });
});
