/**
 * Faithful port of java.util.Random.
 *
 * V2's SimplexNoiseField derives its per-octave domain offsets with
 * `new Random(seed).nextDouble() * 256.0`, so reproducing the game's noise
 * requires reproducing Java's LCG exactly — no other PRNG will do, however
 * well-distributed it is.
 *
 * The algorithm is fully specified by the java.util.Random contract:
 *   seed      = (seed ^ 0x5DEECE66D) & ((1 << 48) - 1)
 *   next(k)   : seed = (seed * 0x5DEECE66D + 0xB) & ((1 << 48) - 1)
 *               return seed >>> (48 - k)
 *   nextDouble: ((next(26) << 27) + next(27)) / 2^53
 *
 * State is 48-bit, which exceeds the 53-bit exact-integer range of a float64
 * once multiplied by the 35-bit multiplier, so BigInt is required for the state
 * update. This is not on a hot path: offsets are generated once per
 * (seed, octaves) pair and cached by the caller.
 */

const MULTIPLIER = 0x5deece66dn;
const ADDEND = 0xbn;
const MASK_48 = (1n << 48n) - 1n;

const TWO_POW_27 = 134217728; // 2^27
const TWO_POW_53 = 9007199254740992; // 2^53

export class JavaRandom {
  private state: bigint;

  constructor(seed: number | bigint) {
    // Java takes a long; mirror the truncation so out-of-int-range seeds behave.
    const asLong = BigInt.asIntN(64, typeof seed === "bigint" ? seed : BigInt(Math.trunc(seed)));
    this.state = (asLong ^ MULTIPLIER) & MASK_48;
  }

  /** java.util.Random#next(int) — returns the top `bits` bits of the new state. */
  next(bits: number): number {
    this.state = (this.state * MULTIPLIER + ADDEND) & MASK_48;
    return Number(this.state >> BigInt(48 - bits));
  }

  /**
   * java.util.Random#nextDouble() — uniform in [0, 1).
   *
   * next(26) < 2^26 and next(27) < 2^27, so `hi * 2^27 + lo` stays below 2^53
   * and is representable exactly in a float64. No precision is lost here.
   */
  nextDouble(): number {
    const hi = this.next(26);
    const lo = this.next(27);
    return (hi * TWO_POW_27 + lo) / TWO_POW_53;
  }

  /**
   * java.util.Random#nextInt() — next(32), cast to a signed 32-bit int.
   *
   * The `| 0` is the Java `(int)` cast: next(32) yields the top 32 bits of the
   * 48-bit state as an unsigned value, which Java reinterprets as signed.
   */
  nextInt(): number {
    return this.next(32) | 0;
  }
}

/**
 * Java's String.hashCode(): h = 31*h + c, wrapping at 32 bits.
 *
 * Duplicated from hytaleNoise.ts rather than imported, to keep this module free
 * of dependencies on the noise layer — the seed chain is used by callers that
 * have nothing to do with simplex.
 */
export function javaStringHashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (Math.imul(31, hash) + s.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Reproduce V2's SeedBox chain to get the integer seed a node actually receives.
 *
 * Verified against the jar (see tools/parity/): SeedBox.child(k) does plain
 * STRING CONCATENATION of keys, and createSupplier() then does
 * `new FastRandom(fullKey.hashCode()).nextInt()`. FastRandom extends
 * java.util.Random and reimplements the identical LCG, so JavaRandom matches it.
 *
 * The hash alone is NOT the seed — for key "MyWorldSeed" + "Skyreach_Base_Density"
 * the hash is 511491888 but the seed the node receives is -1630096005.
 *
 * @param keyChain keys from the root SeedBox down to the node, in order.
 *                 Typically [worldSeed, ...ancestors, nodeSeedField].
 */
export function deriveNodeSeed(...keyChain: string[]): number {
  return new JavaRandom(javaStringHashCode(keyChain.join(""))).nextInt();
}

/**
 * Per-octave domain offsets, matching SimplexNoiseField's constructor.
 *
 * Java always draws FOUR doubles per octave (offsetX, offsetY, offsetZ, offsetW)
 * regardless of how many dimensions the field is later sampled in. Drawing fewer
 * for the 2D case would leave the RNG stream at the wrong position and desync
 * every octave after the first, so the extra draws are deliberate — do not
 * "optimise" them away.
 */
export const OFFSET_DRAWS_PER_OCTAVE = 4;
export const OFFSET_MAGNITUDE = 256.0;

export function generateOctaveOffsets(seed: number, octaves: number, dims: number): number[][] {
  const rng = new JavaRandom(seed);
  const offsets: number[][] = [];
  for (let i = 0; i < octaves; i++) {
    const drawn: number[] = [];
    for (let d = 0; d < OFFSET_DRAWS_PER_OCTAVE; d++) {
      drawn.push(rng.nextDouble() * OFFSET_MAGNITUDE);
    }
    offsets.push(drawn.slice(0, dims));
  }
  return offsets;
}
