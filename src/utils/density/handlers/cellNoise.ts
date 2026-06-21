import type { EvalCtx, NodeHandler } from "../evalContext";
import { resolveCellularJitter } from "../scaleFields";
import { lastVoronoiCellCenter, lastVoronoiCellHash, lastVoronoiDistances } from "../voronoiNoise";
import { primeCellWallDistanceSideChannel } from "./terrainSpecific";

function syncVoronoiSideChannel(ctx: EvalCtx): void {
  ctx.cellWallDist = Math.max(0, (lastVoronoiDistances.d2 - lastVoronoiDistances.d1) / 2.0);
  ctx.cellHash = lastVoronoiCellHash;
  ctx.cellCenterX = lastVoronoiCellCenter.x;
  ctx.cellCenterY = lastVoronoiCellCenter.y;
  ctx.cellCenterZ = lastVoronoiCellCenter.z;
}

const handlePositionsCellNoise: NodeHandler = (ctx, fields, inputs, x, y, z) => {
  const scale = Number(fields.Scale ?? 1.0);
  const seed = ctx.hashSeed(fields.Seed as string | number | undefined);
  const returnType = (fields.ReturnType as string) ?? "Distance";
  const distFn = (fields.DistanceFunction as string) ?? "Euclidean";
  // V2 CellNoiseField doubles jitter: jitter *= 2.0
  const jitter = resolveCellularJitter(fields.Jitter, 0.5) * 2.0;
  const noise = ctx.getVoronoi2D(seed, returnType, jitter, returnType, distFn);
  const sx = scale !== 0 ? x / scale : x;
  const sz = scale !== 0 ? z / scale : z;
  let raw = noise(sx, sz);
  syncVoronoiSideChannel(ctx);
  // ReturnType delegation (matching VoronoiNoise2D/3D handlers)
  if (returnType === "Curve") {
    raw = ctx.applyCurve("ReturnCurve", raw, inputs);
  } else if (returnType === "Density") {
    raw = ctx.getInput(inputs, "ReturnDensity", x, y, z) * raw;
  }
  return raw;
};

const handleCellWallDistance: NodeHandler = (ctx, _fields, _inputs, x, y, z) => {
  if (ctx.cellWallDist < Infinity) {
    return ctx.cellWallDist;
  }
  primeCellWallDistanceSideChannel(ctx, x, y, z);
  if (ctx.cellWallDist < Infinity) {
    return ctx.cellWallDist;
  }
  return 0;
};

const handlePositions3D: NodeHandler = (ctx, fields, inputs, x, y, z) => {
  const scale = Number(fields.Scale ?? 1.0);
  const seed = ctx.hashSeed(fields.Seed as string | number | undefined);
  const returnType = (fields.ReturnType as string) ?? "Distance";
  const distFn = (fields.DistanceFunction as string) ?? "Euclidean";
  const jitter = resolveCellularJitter(fields.Jitter, 0.5) * 2.0;
  const noise = ctx.getVoronoi3D(seed, returnType, jitter, returnType, distFn);
  const sx = scale !== 0 ? x / scale : x;
  const sy = scale !== 0 ? y / scale : y;
  const sz = scale !== 0 ? z / scale : z;
  let raw = noise(sx, sy, sz);
  syncVoronoiSideChannel(ctx);
  // ReturnType delegation (matching VoronoiNoise2D/3D handlers)
  if (returnType === "Curve") {
    raw = ctx.applyCurve("ReturnCurve", raw, inputs);
  } else if (returnType === "Density") {
    raw = ctx.getInput(inputs, "ReturnDensity", x, y, z) * raw;
  }
  return raw;
};

export function buildCellNoiseHandlers(): Map<string, NodeHandler> {
  return new Map<string, NodeHandler>([
    ["PositionsCellNoise", handlePositionsCellNoise],
    ["CellWallDistance", handleCellWallDistance],
    ["Positions3D", handlePositions3D],
  ]);
}
