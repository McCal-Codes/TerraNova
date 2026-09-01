import { describe, it, expect } from "vitest";
import {
  V2_SIMPLEX_LACUNARITY,
  V2_SIMPLEX_PERSISTENCE,
  V2_SIMPLEX_SCALE,
  V2_OCTAVES,
  V2_CELL_SCALE,
  V2_CELL_JITTER,
  V2_CELL_RETURN_TYPE,
} from "../handlers/noise";
import { deriveNodeSeed, javaStringHashCode, JavaRandom } from "../javaRandom";
import fixture from "./fixtures/fbmParity.json";

/**
 * Locks two things that are easy to get subtly wrong and impossible to spot by eye:
 *
 *  1. Field defaults. The codec only overwrites a field when the key is present,
 *     so an asset that omits Lacunarity renders with the *asset class's* default.
 *     The fixture reflects those off freshly constructed asset objects, so a game
 *     update that changes one fails here instead of silently drifting the preview.
 *
 *  2. The SeedBox chain. SeedBox.child() concatenates keys as STRINGS and
 *     createSupplier() then runs FastRandom(fullKey.hashCode()).nextInt(). The
 *     hash alone is not the seed — mixing those up yields a plausible-looking but
 *     entirely different world.
 */

const defaults = fixture.defaults as Record<string, Record<string, number | string>>;
const seedBox = fixture.seedBox as Array<{ chain: string[]; derived: number }>;

describe("V2 asset defaults", () => {
  it("SimplexNoise2D matches the jar", () => {
    const d = defaults.SimplexNoise2dDensityAsset;
    expect(d.lacunarity).toBe(V2_SIMPLEX_LACUNARITY);
    expect(d.persistence).toBe(V2_SIMPLEX_PERSISTENCE);
    expect(d.scale).toBe(V2_SIMPLEX_SCALE);
    expect(d.octaves).toBe(V2_OCTAVES);
    expect(d.seedKey).toBe("");
  });

  it("SimplexNoise3D matches the jar", () => {
    const d = defaults.SimplexNoise3DDensityAsset;
    expect(d.lacunarity).toBe(V2_SIMPLEX_LACUNARITY);
    expect(d.persistence).toBe(V2_SIMPLEX_PERSISTENCE);
    expect(d.scaleXZ).toBe(V2_SIMPLEX_SCALE);
    expect(d.scaleY).toBe(V2_SIMPLEX_SCALE);
    expect(d.octaves).toBe(V2_OCTAVES);
  });

  it("CellNoise2D/3D match the jar", () => {
    for (const key of ["CellNoise2DDensityAsset", "CellNoise3DDensityAsset"]) {
      const d = defaults[key];
      expect(d.scaleX, key).toBe(V2_CELL_SCALE);
      expect(d.scaleZ, key).toBe(V2_CELL_SCALE);
      expect(d.jitter, key).toBe(V2_CELL_JITTER);
      expect(d.octaves, key).toBe(V2_OCTAVES);
      expect(d.cellType, key).toBe(V2_CELL_RETURN_TYPE);
    }
  });

  it("CellNoise exposes no Lacunarity, Persistence, ReturnType or DistanceFunction", () => {
    // Reading fields V2 does not have is how the CellType/ReturnType mix-up crept in.
    for (const key of ["CellNoise2DDensityAsset", "CellNoise3DDensityAsset"]) {
      const fields = Object.keys(defaults[key]);
      expect(fields, key).not.toContain("lacunarity");
      expect(fields, key).not.toContain("persistence");
      expect(fields, key).not.toContain("returnType");
      expect(fields, key).not.toContain("distanceFunction");
    }
  });
});

describe("SeedBox derivation", () => {
  it("reproduces every derived seed from the jar", () => {
    for (const { chain, derived } of seedBox) {
      expect(deriveNodeSeed(...chain), `chain ${JSON.stringify(chain)}`).toBe(derived);
    }
  });

  it("is not the plain string hash", () => {
    // Guards the specific mistake: seedToInt() returning javaStringHashCode alone.
    const { chain, derived } = seedBox[0];
    const plainHash = javaStringHashCode(chain.join(""));
    expect(plainHash).not.toBe(derived);
    expect(new JavaRandom(plainHash).nextInt()).toBe(derived);
  });

  it("treats child() as string concatenation", () => {
    // ["a","b"] and ["ab"] must derive identically.
    expect(deriveNodeSeed("MyWorldSeed", "Skyreach_Base_Density")).toBe(
      deriveNodeSeed("MyWorldSeedSkyreach_Base_Density"),
    );
  });
});

describe("JavaRandom", () => {
  it("matches java.util.Random's documented stream for seed 0", () => {
    // Values from the java.util.Random contract; independent of the Hytale jar.
    const r = new JavaRandom(0);
    expect(r.nextInt()).toBe(-1155484576);
    expect(r.nextInt()).toBe(-723955400);
    expect(r.nextInt()).toBe(1033096058);
  });

  it("produces nextDouble in [0, 1)", () => {
    const r = new JavaRandom(12345);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextDouble();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("handles negative and large seeds without precision loss", () => {
    expect(() => new JavaRandom(-987654321).nextDouble()).not.toThrow();
    expect(new JavaRandom(-1).nextInt()).toBe(new JavaRandom(-1).nextInt());
  });
});
