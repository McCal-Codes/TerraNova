import type { Node } from "@xyflow/react";
import type { NodeHandler } from "../evalContext";
import { getNodeType } from "../evalTypes";

const handleTerrainBoolean: NodeHandler = (ctx, fields, inputs, x, y, z) => {
  const a = ctx.getInput(inputs, "Inputs[0]", x, y, z)
    ?? ctx.getInput(inputs, "Input", x, y, z);
  const b = ctx.getInput(inputs, "Inputs[1]", x, y, z);
  const op = String(fields.Operation ?? "Union");

  switch (op) {
    case "Intersection":
      return Math.min(a, b);
    case "Subtraction":
      return Math.min(a, -b);
    case "Union":
    default:
      return Math.max(a, b);
  }
};

const handlePipeline: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  // Evaluate last connected stage input (compound handle or single Input).
  let last: string | undefined;
  for (const [handle, src] of inputs) {
    if (handle === "Input" || handle.startsWith("stages") || handle.startsWith("Inputs")) {
      last = src;
    }
  }
  if (!last) return 0;
  return ctx.evaluate(last, x, y, z);
};

const handleSurfaceDensity: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  return ctx.getInput(inputs, "Input", x, y, z);
};

const handleTerrainMask: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  const input = ctx.getInput(inputs, "Input", x, y, z);
  const baseY = Number(ctx.contentFields.BaseHeight ?? ctx.contentFields.Base ?? 64);
  const surface = baseY - y;
  return Math.min(input, surface);
};

const handleBeardDensity: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  const input = ctx.getInput(inputs, "Input", x, y, z);
  // Approximate overhang emphasis below exposed surface columns.
  if (input < 0) return input;
  const grad = ctx.getInput(inputs, "Input", x, y + 1, z) - ctx.getInput(inputs, "Input", x, y - 1, z);
  return input - Math.max(0, -grad) * 0.25;
};

const handleColumnDensity: NodeHandler = (ctx, _fields, inputs, x, y, z) => {
  const input = ctx.getInput(inputs, "Input", x, y, z);
  const baseY = Number(ctx.contentFields.BaseHeight ?? ctx.contentFields.Base ?? 64);
  const column = Math.min(input, y - baseY);
  return column;
};

const handleCaveDensity: NodeHandler = (ctx, fields, inputs, x, y, z) => {
  const input = ctx.getInput(inputs, "Input", x, y, z);
  const radius = Number(fields.Radius ?? 4);
  const seed = ctx.hashSeed("CaveDensity");
  const noise = ctx.getNoise3D(seed)(x * 0.04, y * 0.05, z * 0.04);
  // High 3D noise carves voids; approximate legacy CaveDensity carving.
  if (noise > 0.35) {
    return Math.min(input, -(radius * (noise - 0.35)));
  }
  return input;
};

const handleDistanceToBiomeEdge: NodeHandler = (ctx, _fields, _inputs, x, _y, z) => {
  const rangeMin = Number(ctx.contentFields.previewRangeMin ?? -64);
  const rangeMax = Number(ctx.contentFields.previewRangeMax ?? 64);
  const dx = Math.min(Math.abs(x - rangeMin), Math.abs(x - rangeMax));
  const dz = Math.min(Math.abs(z - rangeMin), Math.abs(z - rangeMax));
  return Math.min(dx, dz);
};

export function buildTerrainSpecificHandlers(): Map<string, NodeHandler> {
  return new Map<string, NodeHandler>([
    ["TerrainBoolean", handleTerrainBoolean],
    ["Pipeline", handlePipeline],
    ["SurfaceDensity", handleSurfaceDensity],
    ["TerrainMask", handleTerrainMask],
    ["BeardDensity", handleBeardDensity],
    ["ColumnDensity", handleColumnDensity],
    ["CaveDensity", handleCaveDensity],
    ["DistanceToBiomeEdge", handleDistanceToBiomeEdge],
  ]);
}

/** Node types that use approximate preview handlers in this module. */
export const TERRAIN_SPECIFIC_APPROXIMATED = new Set([
  "TerrainBoolean",
  "Pipeline",
  "SurfaceDensity",
  "TerrainMask",
  "BeardDensity",
  "ColumnDensity",
  "CaveDensity",
  "DistanceToBiomeEdge",
]);

export function isCellNoiseType(type: string): boolean {
  return type === "CellNoise2D"
    || type === "CellNoise3D"
    || type === "VoronoiNoise2D"
    || type === "VoronoiNoise3D"
    || type === "PositionsCellNoise"
    || type === "Positions3D";
}

/** Prime voronoi side-channel by evaluating the first cell-noise node in the graph. */
export function primeCellWallDistanceSideChannel(
  ctx: {
    cellWallDist: number;
    evaluate: (nodeId: string, x: number, y: number, z: number) => number;
    nodeById: Map<string, { data: Record<string, unknown> }>;
  },
  x: number,
  y: number,
  z: number,
): void {
  if (ctx.cellWallDist < Infinity) return;
  for (const [id, node] of ctx.nodeById) {
    const type = getNodeType(node as Node);
    if (!isCellNoiseType(type)) continue;
    ctx.evaluate(id, x, y, z);
    if (ctx.cellWallDist < Infinity) return;
  }
}
