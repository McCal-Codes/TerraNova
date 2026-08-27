import { whiteNoise3D } from "../rngField";
import type { NodeHandler } from "../evalContext";
import { fbm2D, fbm3D, ridgeFbm2D, ridgeFbm3D } from "../fbm";
import { resolveAxisScale, resolveScale, resolveCellularJitter } from "../scaleFields";

/**
 * V2 asset defaults, read from the field initialisers of the corresponding
 * *DensityAsset constructors in HytaleServer.jar. Do not adjust these to taste —
 * they change how every asset that omits the field renders.
 *
 *   SimplexNoise2dDensityAsset: lacunarity 2.0, persistence 0.5, scale 50.0, octaves 1, seed ""
 *   SimplexNoise3DDensityAsset: lacunarity 2.0, persistence 0.5, scaleXZ 50.0, scaleY 50.0, octaves 1
 *   CellNoise2D/3DDensityAsset: scale(s) 50.0, jitter 0.3, octaves 1, cellType CellValue
 *
 * A lacunarity of 1.0 (the previous fallback) makes every octave share one
 * frequency, collapsing multi-octave noise into a single scaled octave.
 */
export const V2_SIMPLEX_LACUNARITY = 2.0;
export const V2_SIMPLEX_PERSISTENCE = 0.5;
export const V2_OCTAVES = 1;
export const V2_SIMPLEX_SCALE = 50.0;
export const V2_CELL_SCALE = 50.0;
export const V2_CELL_JITTER = 0.3;
/** V2's CellType field IS FastNoiseLite's CellularReturnType. */
export const V2_CELL_RETURN_TYPE = "CellValue";
/** CellNoise2D/3D expose no distance-function field; FastNoiseLite's default applies. */
export const V2_CELL_DISTANCE_FUNCTION = "EuclideanSq";

/** Resolve Persistence, with fallback to legacy Gain field. */
function resolvePersistence(fields: Record<string, unknown>, fallback = V2_SIMPLEX_PERSISTENCE): number {
  return Number(fields.Persistence ?? fields.Gain ?? fallback);
}

const handleSimplexNoise2D: NodeHandler = (ctx, fields, _inputs, x, _y, z) => {
  const scale = resolveScale(fields);
  const seed = ctx.hashSeed(fields.Seed as string | number | undefined);
  const octaves = Math.max(1, Number(fields.Octaves ?? V2_OCTAVES));
  const lacunarity = Number(fields.Lacunarity ?? V2_SIMPLEX_LACUNARITY);
  const persistence = resolvePersistence(fields);
  const amp = (fields.Amplitude as number) ?? 1.0;
  const noise = ctx.getNoise2D(seed);
  return fbm2D(noise, x, z, scale, scale, octaves, lacunarity, persistence, seed) * amp;
};

const handleSimplexNoise3D: NodeHandler = (ctx, fields, _inputs, x, y, z) => {
  const scaleXZ = resolveScale({ Scale: fields.ScaleXZ ?? fields.Scale, Frequency: fields.Frequency });
  const scaleY = Number(fields.ScaleY ?? scaleXZ);
  const seed = ctx.hashSeed(fields.Seed as string | number | undefined);
  const octaves = Math.max(1, Number(fields.Octaves ?? V2_OCTAVES));
  const lacunarity = Number(fields.Lacunarity ?? V2_SIMPLEX_LACUNARITY);
  const persistence = resolvePersistence(fields);
  const amp = (fields.Amplitude as number) ?? 1.0;
  const noise = ctx.getNoise3D(seed);
  return fbm3D(noise, x, y, z, scaleXZ, scaleY, octaves, lacunarity, persistence, seed) * amp;
};

/**
 * Legacy defaults for node types that are NOT part of the V2 density registry.
 *
 * SimplexRidgeNoise2D/3D and FractalNoise2D/3D do not exist in
 * com.hypixel.hytale.builtin.hytalegenerator.assets.density — the registry has
 * no ridged-simplex path at all (ridged fractals live in FastNoiseLite, which
 * V2 uses only for cell noise). These handlers therefore serve TerraNova-local
 * or imported-legacy graphs, and keep their historical fallbacks so existing
 * projects render unchanged. Do not "align" them with the V2 constants above.
 */
const LEGACY_LACUNARITY = 1.0;
const LEGACY_PERSISTENCE = 1.0;

const handleSimplexRidgeNoise2D: NodeHandler = (ctx, fields, _inputs, x, _y, z) => {
  const scale = resolveScale(fields);
  const seed = ctx.hashSeed(fields.Seed as string | number | undefined);
  const octaves = Math.max(1, Number(fields.Octaves ?? 1));
  const lacunarity = Number(fields.Lacunarity ?? LEGACY_LACUNARITY);
  const persistence = resolvePersistence(fields, LEGACY_PERSISTENCE);
  const noise = ctx.getNoise2D(seed);
  return ridgeFbm2D(noise, x, z, scale, scale, octaves, lacunarity, persistence, seed);
};

const handleSimplexRidgeNoise3D: NodeHandler = (ctx, fields, _inputs, x, y, z) => {
  const scaleXZ = resolveScale({ Scale: fields.ScaleXZ ?? fields.Scale, Frequency: fields.Frequency });
  const scaleY = Number(fields.ScaleY ?? scaleXZ);
  const seed = ctx.hashSeed(fields.Seed as string | number | undefined);
  const octaves = Math.max(1, Number(fields.Octaves ?? 1));
  const lacunarity = Number(fields.Lacunarity ?? LEGACY_LACUNARITY);
  const persistence = resolvePersistence(fields, LEGACY_PERSISTENCE);
  const noise = ctx.getNoise3D(seed);
  return ridgeFbm3D(noise, x, y, z, scaleXZ, scaleY, octaves, lacunarity, persistence, seed);
};

const handleCellNoise2D: NodeHandler = (ctx, fields, inputs, x, y, z) => {
  const scaleX = resolveAxisScale(fields, "ScaleX");
  const scaleZ = resolveAxisScale(fields, "ScaleZ");
  const seed = ctx.hashSeed(fields.Seed as string | number | undefined);
  const cellType = (fields.CellType as string) ?? "Euclidean";
  const jitter = resolveCellularJitter(fields.Jitter, 0.5);
  const octaves = Math.max(1, Number(fields.Octaves ?? 1));
  const lacunarity = Number(fields.Lacunarity ?? 2.0);
  const persistence = resolvePersistence(fields, 0.5);
  const returnType = (fields.ReturnType as string) ?? "Distance";
  const distFunc = (fields.DistanceFunction as string) ?? "Euclidean";
  const noise = ctx.getVoronoi2D(seed, cellType, jitter, returnType, distFunc);
  const sx = scaleX !== 0 ? x / scaleX : x;
  const sz = scaleZ !== 0 ? z / scaleZ : z;
  let raw = octaves > 1
    ? fbm2D(noise, x, z, scaleX, scaleZ, octaves, lacunarity, persistence, seed)
    : noise(sx, sz);
  if (returnType === "Curve") {
    raw = ctx.applyCurve("ReturnCurve", raw, inputs);
  } else if (returnType === "Density") {
    raw = ctx.getInput(inputs, "ReturnDensity", x, y, z) * raw;
  }
  return raw;
};

const handleCellNoise3D: NodeHandler = (ctx, fields, inputs, x, y, z) => {
  const scaleX = resolveAxisScale(fields, "ScaleX");
  const scaleY = resolveAxisScale(fields, "ScaleY");
  const scaleZ = resolveAxisScale(fields, "ScaleZ");
  const seed = ctx.hashSeed(fields.Seed as string | number | undefined);
  const cellType = (fields.CellType as string) ?? "Euclidean";
  const jitter = resolveCellularJitter(fields.Jitter, 0.5);
  const octaves = Math.max(1, Number(fields.Octaves ?? 1));
  const lacunarity = Number(fields.Lacunarity ?? 2.0);
  const persistence = resolvePersistence(fields, 0.5);
  const returnType = (fields.ReturnType as string) ?? "Distance";
  const distFunc = (fields.DistanceFunction as string) ?? "Euclidean";
  const noise = ctx.getVoronoi3D(seed, cellType, jitter, returnType, distFunc);
  const sx = scaleX !== 0 ? x / scaleX : x;
  const sy = scaleY !== 0 ? y / scaleY : y;
  const sz = scaleZ !== 0 ? z / scaleZ : z;
  let raw = octaves > 1
    ? fbm3D(noise, x, y, z, scaleX, scaleY, octaves, lacunarity, persistence, seed, scaleZ)
    : noise(sx, sy, sz);
  if (returnType === "Curve") {
    raw = ctx.applyCurve("ReturnCurve", raw, inputs);
  } else if (returnType === "Density") {
    raw = ctx.getInput(inputs, "ReturnDensity", x, y, z) * raw;
  }
  return raw;
};

/** Not a V2 registry type — see LEGACY_* note above. */
const handleFractalNoise2D: NodeHandler = (ctx, fields, _inputs, x, _y, z) => {
  const scale = resolveScale(fields);
  const octaves = Math.max(1, Number(fields.Octaves ?? 1));
  const lacunarity = Number(fields.Lacunarity ?? LEGACY_LACUNARITY);
  const persistence = resolvePersistence(fields, LEGACY_PERSISTENCE);
  const seed = ctx.hashSeed(fields.Seed as string | number | undefined);
  const noise = ctx.getNoise2D(seed);
  return fbm2D(noise, x, z, scale, scale, octaves, lacunarity, persistence, seed);
};

/** Not a V2 registry type — see LEGACY_* note above. */
const handleFractalNoise3D: NodeHandler = (ctx, fields, _inputs, x, y, z) => {
  const scaleXZ = resolveScale({ Scale: fields.ScaleXZ ?? fields.Scale, Frequency: fields.Frequency });
  const scaleY = Number(fields.ScaleY ?? scaleXZ);
  const octaves = Math.max(1, Number(fields.Octaves ?? 1));
  const lacunarity = Number(fields.Lacunarity ?? LEGACY_LACUNARITY);
  const persistence = resolvePersistence(fields, LEGACY_PERSISTENCE);
  const seed = ctx.hashSeed(fields.Seed as string | number | undefined);
  const noise = ctx.getNoise3D(seed);
  return fbm3D(noise, x, y, z, scaleXZ, scaleY, octaves, lacunarity, persistence, seed);
};

/**
 * `WhiteNoise` (Update 6) — uniform random in [-1, 1], deterministic per
 * position.
 *
 * A hash rather than a stream: the engine seeds a fresh random from the
 * positional hash and takes one draw, so evaluation order never affects the
 * result. See density/rngField.ts, which is pinned bit-exactly against the jar.
 */
const handleWhiteNoise: NodeHandler = (ctx, fields, _inputs, x, y, z) => {
  const seed = ctx.hashSeed(fields.Seed as string | number | undefined);
  return whiteNoise3D(seed, x, y, z);
};

export function buildNoiseHandlers(): Map<string, NodeHandler> {
  return new Map<string, NodeHandler>([
    ["WhiteNoise", handleWhiteNoise],
    ["SimplexNoise2D", handleSimplexNoise2D],
    ["SimplexNoise3D", handleSimplexNoise3D],
    ["SimplexRidgeNoise2D", handleSimplexRidgeNoise2D],
    ["SimplexRidgeNoise3D", handleSimplexRidgeNoise3D],
    ["CellNoise2D", handleCellNoise2D],
    ["VoronoiNoise2D", handleCellNoise2D],
    ["CellNoise3D", handleCellNoise3D],
    ["VoronoiNoise3D", handleCellNoise3D],
    ["FractalNoise2D", handleFractalNoise2D],
    ["FractalNoise3D", handleFractalNoise3D],
  ]);
}
