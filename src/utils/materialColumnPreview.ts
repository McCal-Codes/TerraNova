import type { Node, Edge } from "@xyflow/react";
import { createEvaluationContext } from "@/utils/densityEvaluator";
import { evaluateMaterialGraph } from "@/utils/materialEvaluator";
import { SOLID_THRESHOLD } from "@/utils/voxelExtractor";
import { resolveVoxelMaterialColor } from "@/utils/materialResolver";
import type { VoxelMaterialGraph } from "@/utils/voxelMaterialPreview";

export type MaterialScaffoldPreset = "surface" | "deepColumn" | "caveCeiling" | "caveFloor";

export type MaterialPreviewView = "column" | "surface";

export interface MaterialColumnRow {
  y: number;
  yi: number;
  material: string | null;
  color: string;
  isSolid: boolean;
}

export interface MaterialSurfaceCell {
  x: number;
  z: number;
  material: string | null;
  color: string;
}

export interface MaterialColumnPreviewResult {
  rows: MaterialColumnRow[];
  palette: { name: string; color: string }[];
  yMin: number;
  yMax: number;
}

export interface MaterialSurfacePreviewResult {
  cells: MaterialSurfaceCell[];
  resolution: number;
  surfaceY: number;
  palette: { name: string; color: string }[];
}

export interface MaterialColumnPreviewInput {
  materialGraph: VoxelMaterialGraph;
  preset: MaterialScaffoldPreset;
  surfaceY?: number;
  yMin?: number;
  yMax?: number;
  ySlices?: number;
  terrainNodes?: Node[];
  terrainEdges?: Edge[];
  useTerrainShape?: boolean;
}

const DEFAULT_Y_MIN = 0;
const DEFAULT_Y_MAX = 128;
const DEFAULT_SURFACE_Y = 64;
const COLUMN_SLICES = 48;
const SURFACE_RES = 32;

function worldYForSlice(yi: number, ySlices: number, yMin: number, yMax: number): number {
  const stepY = (yMax - yMin) / Math.max(1, ySlices);
  return yMin + (yi + 0.5) * stepY;
}

function isSolidAtPreset(
  preset: MaterialScaffoldPreset,
  worldY: number,
  yMin: number,
  yMax: number,
  surfaceY: number,
): boolean {
  const span = Math.max(1, yMax - yMin);
  const rel = (worldY - yMin) / span;
  switch (preset) {
    case "surface":
      return worldY < surfaceY;
    case "deepColumn":
      return true;
    case "caveCeiling":
      return rel < 0.15 || rel > 0.55;
    case "caveFloor":
      return rel < 0.35 || rel > 0.85;
    default:
      return worldY < surfaceY;
  }
}

/** Build a synthetic density volume for material-only preview. */
export function buildSyntheticColumnDensities(
  preset: MaterialScaffoldPreset,
  options: {
    resolution: number;
    ySlices: number;
    yMin: number;
    yMax: number;
    surfaceY: number;
  },
): Float32Array {
  const { resolution: n, ySlices: ys, yMin, yMax, surfaceY } = options;
  const densities = new Float32Array(n * n * ys);

  for (let yi = 0; yi < ys; yi++) {
    const worldY = worldYForSlice(yi, ys, yMin, yMax);
    const solid = isSolidAtPreset(preset, worldY, yMin, yMax, surfaceY);
    const val = solid ? 1 : -1;
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        densities[yi * n * n + z * n + x] = val;
      }
    }
  }

  return densities;
}

function buildFlatSurfaceDensities(
  resolution: number,
  ySlices: number,
  yMin: number,
  yMax: number,
  surfaceY: number,
): Float32Array {
  return buildSyntheticColumnDensities("surface", {
    resolution,
    ySlices,
    yMin,
    yMax,
    surfaceY,
  });
}

function paletteFromResult(palette: { name: string; color: string }[]) {
  return palette.map((m) => ({ name: m.name, color: m.color }));
}

/** Evaluate material graph on a synthetic column and return strip rows. */
export function evaluateMaterialColumnPreview(
  input: MaterialColumnPreviewInput,
): MaterialColumnPreviewResult | null {
  const { materialGraph, preset } = input;
  if (materialGraph.source === "none" || materialGraph.nodes.length === 0) {
    return null;
  }

  const yMin = input.yMin ?? DEFAULT_Y_MIN;
  const yMax = input.yMax ?? DEFAULT_Y_MAX;
  const surfaceY = input.surfaceY ?? DEFAULT_SURFACE_Y;
  const ySlices = input.ySlices ?? COLUMN_SLICES;
  const n = 1;

  const densities = buildSyntheticColumnDensities(preset, {
    resolution: n,
    ySlices,
    yMin,
    yMax,
    surfaceY,
  });

  const densityCtx =
    input.useTerrainShape && input.terrainNodes?.length
      ? createEvaluationContext(input.terrainNodes, input.terrainEdges ?? [], undefined, {
          contentFields: {},
        }) ?? undefined
      : undefined;

  const matResult = evaluateMaterialGraph(
    materialGraph.nodes,
    materialGraph.edges,
    densities,
    n,
    ySlices,
    0,
    n,
    yMin,
    yMax,
    densityCtx,
  );

  if (!matResult) return null;

  const rows: MaterialColumnRow[] = [];
  for (let yi = 0; yi < ySlices; yi++) {
    const worldY = worldYForSlice(yi, ySlices, yMin, yMax);
    const idx = yi * n * n;
    const isSolid = densities[idx]! >= SOLID_THRESHOLD;
    let material: string | null = null;
    if (isSolid) {
      const matId = matResult.materialIds[idx]!;
      material = matResult.palette[matId]?.name ?? null;
    }
    rows.push({
      y: worldY,
      yi,
      material,
      color: material ? resolveVoxelMaterialColor(material) : "#00000000",
      isSolid,
    });
  }

  return {
    rows,
    palette: paletteFromResult(matResult.palette.map((m) => ({ name: m.name, color: m.color }))),
    yMin,
    yMax,
  };
}

/** Top-down surface block per column at surfaceY (flat slab unless terrain-linked). */
export function evaluateMaterialSurfacePreview(
  input: MaterialColumnPreviewInput,
): MaterialSurfacePreviewResult | null {
  const { materialGraph } = input;
  if (materialGraph.source === "none" || materialGraph.nodes.length === 0) {
    return null;
  }

  const yMin = input.yMin ?? DEFAULT_Y_MIN;
  const yMax = input.yMax ?? DEFAULT_Y_MAX;
  const surfaceY = input.surfaceY ?? DEFAULT_SURFACE_Y;
  const n = SURFACE_RES;
  const ySlices = COLUMN_SLICES;

  const densities = buildFlatSurfaceDensities(n, ySlices, yMin, yMax, surfaceY);

  const densityCtx =
    input.useTerrainShape && input.terrainNodes?.length
      ? createEvaluationContext(input.terrainNodes, input.terrainEdges ?? [], undefined, {
          contentFields: {},
        }) ?? undefined
      : undefined;

  const matResult = evaluateMaterialGraph(
    materialGraph.nodes,
    materialGraph.edges,
    densities,
    n,
    ySlices,
    0,
    n,
    yMin,
    yMax,
    densityCtx,
  );

  if (!matResult) return null;

  const cells: MaterialSurfaceCell[] = [];
  const surfaceYi = Math.min(
    ySlices - 1,
    Math.max(0, Math.floor(((surfaceY - yMin) / Math.max(1, yMax - yMin)) * ySlices)),
  );

  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const idx = surfaceYi * n * n + z * n + x;
      const isSolid = densities[idx]! >= SOLID_THRESHOLD;
      let material: string | null = null;
      if (isSolid) {
        const matId = matResult.materialIds[idx]!;
        material = matResult.palette[matId]?.name ?? null;
      }
      cells.push({
        x,
        z,
        material,
        color: material ? resolveVoxelMaterialColor(material) : "#00000000",
      });
    }
  }

  return {
    cells,
    resolution: n,
    surfaceY,
    palette: paletteFromResult(matResult.palette.map((m) => ({ name: m.name, color: m.color }))),
  };
}
