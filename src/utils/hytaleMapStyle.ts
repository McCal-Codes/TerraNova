/**
 * Hytale's own world-map rendering, ported from the shared source release.
 *
 * Source of truth:
 *   HytaleServer/CoreServer/.../universe/world/worldmap/provider/chunk/ImageBuilder.java
 *   HytaleServer/WorldGenerator/.../loader/biome/BiomeJsonLoader.java
 *
 * Every constant below is copied from that code, not tuned. If a shaded preview
 * disagrees with the game the bug is here, so please do not "improve" these
 * numbers — `hytaleMapStyle.test.ts` pins them for exactly that reason.
 */

/**
 * Sunlight direction, pre-normalisation.
 * `ImageBuilder.java:42` — `private static final float LX = -0.2f, LY = 0.8f, LZ = 0.5f;`
 */
const LX = -0.2;
const LY = 0.8;
const LZ = 0.5;

const INV_L = 1 / Math.sqrt(LX * LX + LY * LY + LZ * LZ);

/** Normalised sunlight direction (`ImageBuilder.java:43-46`). */
export const HYTALE_LIGHT: readonly [number, number, number] = [
  LX * INV_L,
  LY * INV_L,
  LZ * INV_L,
];

/**
 * Vertical component of the surface normal, in blocks.
 *
 * `ImageBuilder.shadeFromHeights` hard-codes `float dy = 3f;`. This is not a
 * relief strength that Hytale exposes anywhere — there is nothing to tune.
 */
export const HYTALE_DY = 3;

/** `float ambient = 0.4f, diffuse = 0.6f;` (`ImageBuilder.shadeFromHeights`). */
export const HYTALE_AMBIENT = 0.4;
export const HYTALE_DIFFUSE = 0.6;

/**
 * Verbatim port of `ImageBuilder.shadeFromHeights`.
 *
 * Heights are in **blocks** — the Java signature takes `short` block Y values.
 * `u` and `v` are the sample's position inside the block, `[0..1]`: `u = 0` is
 * the west edge, `v = 0` the north edge. At one pixel per block both are 0.5,
 * which is what {@link computeHytaleShade} passes.
 *
 * Returns a multiplier in `[HYTALE_AMBIENT, HYTALE_AMBIENT + HYTALE_DIFFUSE]`.
 */
export function shadeFromHeights(
  height: number,
  north: number,
  south: number,
  west: number,
  east: number,
  northWest: number,
  northEast: number,
  southWest: number,
  southEast: number,
  u = 0.5,
  v = 0.5,
): number {
  // ud,vd [0..1] within the block along the diagonals:
  // ud=0 is northWest, ud=1 is southEast; vd=0 is northEast, vd=1 is southWest.
  const ud = (u + v) / 2;
  const vd = (1 - u + v) / 2;

  // Gradients by bilinear interpolation — cardinals, then diagonals.
  const dhdx1 = (height - west) * (1 - u) + (east - height) * u;
  const dhdz1 = (height - north) * (1 - v) + (south - height) * v;
  const dhdx2 = (height - northWest) * (1 - ud) + (southEast - height) * ud;
  const dhdz2 = (height - northEast) * (1 - vd) + (southWest - height) * vd;

  // Combined, giving more weight to the cardinal directions.
  const dhdx = dhdx1 * 2 + dhdx2;
  const dhdz = dhdz1 * 2 + dhdz2;

  let nx = dhdx;
  let ny = HYTALE_DY;
  let nz = dhdz;
  const invS = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
  nx *= invS;
  ny *= invS;
  nz *= invS;

  const lambert = Math.max(
    0,
    nx * HYTALE_LIGHT[0] + ny * HYTALE_LIGHT[1] + nz * HYTALE_LIGHT[2],
  );

  return HYTALE_AMBIENT + HYTALE_DIFFUSE * lambert;
}

/**
 * {@link shadeFromHeights} for one cell of a square height grid, in blocks.
 *
 * Hytale reads neighbours across chunk borders; a preview grid has no such
 * neighbours, so out-of-grid samples clamp to the edge cell. That flattens the
 * outermost row and column rather than inventing terrain beyond them.
 */
export function computeHytaleShade(
  heights: ArrayLike<number>,
  size: number,
  col: number,
  row: number,
): number {
  const at = (c: number, r: number): number => {
    const cc = c < 0 ? 0 : c >= size ? size - 1 : c;
    const rr = r < 0 ? 0 : r >= size ? size - 1 : r;
    return heights[rr * size + cc];
  };

  // Rows increase southward, matching ImageBuilder's z axis.
  return shadeFromHeights(
    at(col, row),
    at(col, row - 1),
    at(col, row + 1),
    at(col - 1, row),
    at(col + 1, row),
    at(col - 1, row - 1),
    at(col + 1, row - 1),
    at(col - 1, row + 1),
    at(col + 1, row + 1),
  );
}

/**
 * A biome's `MapColor`.
 *
 * `BiomeJsonLoader.java` — `String KEY_MAP_COLOR = "MapColor";`, documented as
 * "the color to be used on the world map for this biome". 285 of the shipped
 * biome files define it, as a `#rrggbb` string.
 *
 * Returns null for anything that is not a six-digit hex colour; callers are
 * expected to fall back rather than substitute a colour of their own.
 */
export function parseMapColor(value: unknown): [number, number, number] | null {
  if (typeof value !== "string") return null;
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const n = parseInt(hex, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Formats an RGB triple back to the `#rrggbb` form biome JSON uses. */
export function formatMapColor(rgb: readonly [number, number, number]): string {
  const part = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`;
}

/**
 * Colour used when a biome has no `MapColor`.
 *
 * Deliberately a neutral grey rather than a guess at what the biome should look
 * like: on a worldgen tool "this biome has no MapColor" is useful signal, and
 * the preview HUD says so alongside it.
 */
export const HYTALE_MAP_COLOR_FALLBACK: readonly [number, number, number] = [
  0x80, 0x80, 0x80,
];

/**
 * TerraNova's 2D preview shows a **density slice**, not a surface heightmap —
 * it has no block-Y field to hand to {@link computeHytaleShade}. The normalised
 * slice is therefore stretched over this many blocks so that relief reads at
 * roughly the intensity Hytale's map gives real terrain against `HYTALE_DY = 3`.
 *
 * Unlike everything above this is TerraNova's own number, not Hytale's. It goes
 * away if the preview ever carries a real surface height field.
 */
export const PREVIEW_HEIGHT_SPAN_BLOCKS = 64;

/**
 * Maps a normalised `[0..1]` field onto pseudo block heights for shading.
 * See {@link PREVIEW_HEIGHT_SPAN_BLOCKS} for why this conversion exists.
 */
export function normalisedToBlockHeights(
  normalised: ArrayLike<number>,
  span = PREVIEW_HEIGHT_SPAN_BLOCKS,
): Float32Array {
  const out = new Float32Array(normalised.length);
  for (let i = 0; i < normalised.length; i++) out[i] = normalised[i] * span;
  return out;
}
