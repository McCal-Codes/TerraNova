import type { CellShapeGridParams } from "./cellShapeGrid";
import { isCellNoiseType } from "./shapePreviewProfile";
import { resolveAxisScale, resolveScale } from "@/utils/density/scaleFields";

/** Read scale/seed/jitter from PCN or CellNoise node fields for shape-grid sampling. */
export function getCellNoisePreviewFields(
  nodeType: string,
  fields: Record<string, unknown>,
  yLevel: number,
): CellShapeGridParams | null {
  if (!isCellNoiseType(nodeType)) return null;

  const scale = resolveScale(fields);
  const scaleX = resolveAxisScale(fields, "ScaleX");
  const scaleY = resolveAxisScale(fields, "ScaleY");
  const scaleZ = resolveAxisScale(fields, "ScaleZ");
  const useSplitScale = nodeType === "CellNoise2D" || nodeType === "VoronoiNoise2D"
    || nodeType === "CellNoise3D" || nodeType === "VoronoiNoise3D";

  const cellType = (fields.CellType as string) ?? "Distance";
  const returnType = (fields.ReturnType as string) ?? cellType;

  return {
    scale: useSplitScale ? undefined : scale,
    scaleX: useSplitScale ? scaleX : undefined,
    scaleY: useSplitScale ? scaleY : undefined,
    scaleZ: useSplitScale ? scaleZ : undefined,
    seed: fields.Seed as string | number | undefined,
    jitter: Number(fields.Jitter ?? 0.5),
    cellType,
    returnType,
    distanceFunction: (fields.DistanceFunction as string) ?? "Euclidean",
    use3D: nodeType === "Positions3D" || nodeType === "CellNoise3D" || nodeType === "VoronoiNoise3D",
    yLevel,
  };
}
