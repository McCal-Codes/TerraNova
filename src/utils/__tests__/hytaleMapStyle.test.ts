import { describe, it, expect } from "vitest";
import {
  HYTALE_AMBIENT,
  HYTALE_DIFFUSE,
  HYTALE_DY,
  HYTALE_LIGHT,
  HYTALE_MAP_COLOR_FALLBACK,
  computeHytaleShade,
  formatMapColor,
  normalisedToBlockHeights,
  parseMapColor,
  shadeFromHeights,
} from "../hytaleMapStyle";

/**
 * Expected values were produced by compiling the `shadeFromHeights` method and
 * light constants straight out of Hytale's `ImageBuilder.java` into a
 * standalone class and running it on these grids. They are the Java output, not
 * this module's output — if a change here makes them fail, the port has drifted
 * from the game.
 *
 * Compared to 6 decimal places rather than exactly: Java computes the whole
 * function in `float`, JavaScript in double, which puts the two roughly 3e-8
 * apart. That gap is arithmetic width, not a difference in the algorithm.
 */
describe("shading parity with ImageBuilder.java", () => {
  // Row-major 3x3: NW N NE / W H E / SW S SE
  const CASES: Array<{ name: string; grid: number[]; expected: number }> = [
    { name: "flat", grid: [10, 10, 10, 10, 10, 10, 10, 10, 10], expected: 0.8977368474 },
    // A symmetric peak cancels in both gradients, so it shades like flat ground.
    { name: "symmetric peak", grid: [0, 0, 0, 0, 10, 0, 0, 0, 0], expected: 0.8977368474 },
    { name: "west-facing slope", grid: [30, 20, 10, 30, 20, 10, 30, 20, 10], expected: 0.6624635458 },
    { name: "south step", grid: [5, 5, 5, 5, 5, 5, 40, 40, 40], expected: 0.6823400259 },
    { name: "irregular", grid: [0, 3, 9, 2, 7, 1, 8, 4, 6], expected: 0.7845779657 },
  ];

  for (const { name, grid, expected } of CASES) {
    it(`matches the Java output for a ${name} grid`, () => {
      expect(computeHytaleShade(grid, 3, 1, 1)).toBeCloseTo(expected, 6);
    });
  }

  it("pins the light direction to the normalised (-0.2, 0.8, 0.5) of ImageBuilder.java", () => {
    expect(HYTALE_LIGHT[0]).toBeCloseTo(-0.2073903382, 6);
    expect(HYTALE_LIGHT[1]).toBeCloseTo(0.8295613527, 6);
    expect(HYTALE_LIGHT[2]).toBeCloseTo(0.5184758306, 6);
  });

  it("pins dy and the ambient/diffuse split", () => {
    // These are hard-coded in the game. There is no relief-strength control to
    // expose, and tuning them makes the preview disagree with the world map.
    expect(HYTALE_DY).toBe(3);
    expect(HYTALE_AMBIENT).toBe(0.4);
    expect(HYTALE_DIFFUSE).toBe(0.6);
  });

  it("stays inside the ambient..ambient+diffuse range", () => {
    for (const { grid } of CASES) {
      const shade = computeHytaleShade(grid, 3, 1, 1);
      expect(shade).toBeGreaterThanOrEqual(HYTALE_AMBIENT);
      expect(shade).toBeLessThanOrEqual(HYTALE_AMBIENT + HYTALE_DIFFUSE);
    }
  });

  it("weights cardinal neighbours twice as heavily as diagonals", () => {
    const flat = 10;
    const cardinal = shadeFromHeights(flat, flat, flat, flat + 6, flat, flat, flat, flat, flat);
    const diagonal = shadeFromHeights(flat, flat, flat, flat, flat, flat + 6, flat, flat, flat);
    expect(Math.abs(cardinal - 0.8977368474)).toBeGreaterThan(
      Math.abs(diagonal - 0.8977368474),
    );
  });

  it("clamps out-of-grid neighbours to the edge rather than reading past the array", () => {
    const grid = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(Number.isFinite(computeHytaleShade(grid, 3, col, row))).toBe(true);
      }
    }
  });
});

describe("parseMapColor", () => {
  it("reads the #rrggbb form the shipped biome files use", () => {
    expect(parseMapColor("#4e8015")).toEqual([0x4e, 0x80, 0x15]);
  });

  it("round-trips through formatMapColor", () => {
    const rgb = parseMapColor("#4e8015")!;
    expect(formatMapColor(rgb)).toBe("#4e8015");
  });

  it("tolerates a missing hash and surrounding whitespace", () => {
    expect(parseMapColor("  4e8015 ")).toEqual([0x4e, 0x80, 0x15]);
  });

  it("returns null rather than a substitute colour when the value is unusable", () => {
    // Callers decide the fallback; this must never quietly invent one.
    for (const bad of [undefined, null, "", "#fff", "#12345g", 42, {}]) {
      expect(parseMapColor(bad)).toBeNull();
    }
  });

  it("has a neutral fallback, not a guess at what the biome looks like", () => {
    const [r, g, b] = HYTALE_MAP_COLOR_FALLBACK;
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});

describe("normalisedToBlockHeights", () => {
  it("stretches a 0..1 field over the documented block span", () => {
    expect(Array.from(normalisedToBlockHeights([0, 0.5, 1], 64))).toEqual([0, 32, 64]);
  });

  it("leaves a flat field flat, so flat terrain shades like flat terrain", () => {
    const heights = normalisedToBlockHeights(new Array(9).fill(0.25));
    expect(computeHytaleShade(heights, 3, 1, 1)).toBeCloseTo(0.8977368474, 6);
  });
});
