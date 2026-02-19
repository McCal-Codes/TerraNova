import type { NodeHandler } from "../evalContext";

const handlePositionsCellNoise: NodeHandler = (ctx, fields, _inputs, x, _y, z) => {
  const maxDist = Number(fields.MaxDistance ?? 0);
  const freq = maxDist > 0 ? 1 / maxDist : Number(fields.Frequency ?? 0.01);
  const seed = ctx.hashSeed(fields.Seed as string | number | undefined);
  const returnType = (fields.ReturnType as string) ?? "Distance";
  const distFn = (fields.DistanceFunction as string) ?? "Euclidean";
  const noise = ctx.getVoronoi2D(seed, distFn, 1.0);
  let raw = noise(x * freq, z * freq);
  if (returnType === "Distance2Div") {
    raw = Math.abs(raw);
  }
  ctx.cellWallDist = Math.max(0, 0.5 - Math.abs(raw));
  return raw;
};

const handleCellWallDistance: NodeHandler = (ctx) => {
  if (ctx.cellWallDist < Infinity) {
    return ctx.cellWallDist;
  }
  return 0;
};

const handlePositions3D: NodeHandler = (ctx, fields, _inputs, x, y, z) => {
  const freq = Number(fields.Frequency ?? 0.01);
  const seed = ctx.hashSeed(fields.Seed as string | number | undefined);
  const noise = ctx.getVoronoi3D(seed, "Euclidean", 1.0);
  return noise(x * freq, y * freq, z * freq);
};

export function buildCellNoiseHandlers(): Map<string, NodeHandler> {
  return new Map<string, NodeHandler>([
    ["PositionsCellNoise", handlePositionsCellNoise],
    ["CellWallDistance", handleCellWallDistance],
    ["Positions3D", handlePositions3D],
  ]);
}
