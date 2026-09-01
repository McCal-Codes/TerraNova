/**
 * V2's positional hash (`rng.RngField` / `rng.Rng`), and the `WhiteNoise`
 * density node built on it. New in Update 6.
 *
 * Transcribed from the shipped `HytaleServer.jar` bytecode rather than guessed,
 * and pinned by tools/parity/WhiteNoiseParity.java. Every constant below is
 * load-bearing: change one and the terrain changes.
 */

import { JavaRandom } from "./javaRandom";

const MIX_Y = 198491317;
const MIX_Z = 6542989;
const HASH_MUL_1 = 1759714724;
const HASH_SUB = 1255572915;
const HASH_MUL_2 = 458671337;

const F32 = new DataView(new ArrayBuffer(4));

/** `Float.floatToRawIntBits((float) value)`. */
export function floatToRawIntBits(value: number): number {
  F32.setFloat32(0, Math.fround(value));
  return F32.getInt32(0);
}

/** `Integer.rotateLeft(value, 1)`. */
function rotateLeft1(value: number): number {
  return ((value << 1) | (value >>> 31)) | 0;
}

/** `Rng.getRandomInt(seed, value)`. */
export function rngGetRandomInt(seed: number, value: number): number {
  let v = value | 0;
  v = Math.imul(v, HASH_MUL_1);
  v = (v + seed) | 0;
  v ^= v >>> 8;
  v = (v - HASH_SUB) | 0;
  v ^= v << 8;
  v = Math.imul(v, HASH_MUL_2);
  v ^= v >>> 8;
  return v | 0;
}

/** `Rng.mix(seed, x, y, z)`. */
export function rngMix(seed: number, x: number, y: number, z: number): number {
  const combined = (x + Math.imul(MIX_Y, y) + Math.imul(MIX_Z, z)) | 0;
  return rngGetRandomInt(seed, combined);
}

/**
 * `RngField.get(x, y, z)`.
 *
 * Coordinates are narrowed to float32 before hashing, so positions closer
 * together than float precision collide — that is the engine's behaviour, not
 * an approximation on our side.
 */
export function rngFieldGet3D(seed: number, x: number, y: number, z: number): number {
  return rngMix(
    seed,
    rotateLeft1(floatToRawIntBits(x)),
    rotateLeft1(floatToRawIntBits(y)),
    rotateLeft1(floatToRawIntBits(z)),
  );
}

/**
 * `WhiteNoiseDensity.process()` — uniform in [-1, 1], deterministic per
 * position.
 *
 * The engine seeds a fresh random from the positional hash and takes a single
 * draw, so this is a hash rather than a stream: evaluation order never affects
 * the result.
 */
export function whiteNoise3D(seed: number, x: number, y: number, z: number): number {
  return new JavaRandom(rngFieldGet3D(seed, x, y, z)).nextDouble() * 2 - 1;
}
