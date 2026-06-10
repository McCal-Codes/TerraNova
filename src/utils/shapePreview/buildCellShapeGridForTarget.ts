import type { Node, Edge } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";
import {
  evaluateCellShapeGrid,
  mergeCellShapeGrids,
  type CellShapeGridResult,
} from "./cellShapeGrid";
import { getCellNoisePreviewFields } from "./cellNoisePreviewFields";
import {
  findUpstreamCellNoiseNodes,
  SHAPE_PREVIEW_COMBINER_TYPES,
} from "./combinerShapePreview";

/** Build Voronoi cell overlay grid for a preview target (direct PCN or merged upstream on combiners). */
export function buildCellShapeGridForTarget(
  nodes: Node[],
  edges: Edge[],
  target: Node,
  rangeMin: number,
  rangeMax: number,
  gridRes: number,
  sliceY: number,
): CellShapeGridResult | null {
  const type = getNodeType(target);
  const fields = ((target.data as Record<string, unknown>)?.fields ?? {}) as Record<
    string,
    unknown
  >;

  const direct = getCellNoisePreviewFields(type, fields, sliceY);
  if (direct) {
    return evaluateCellShapeGrid(rangeMin, rangeMax, gridRes, direct);
  }

  if (!SHAPE_PREVIEW_COMBINER_TYPES.has(type)) return null;

  const upstream = findUpstreamCellNoiseNodes(nodes, edges, target.id);
  const grids: CellShapeGridResult[] = [];
  for (const node of upstream) {
    const cf = getCellNoisePreviewFields(
      getNodeType(node),
      ((node.data as Record<string, unknown>)?.fields ?? {}) as Record<string, unknown>,
      sliceY,
    );
    if (cf) grids.push(evaluateCellShapeGrid(rangeMin, rangeMax, gridRes, cf));
  }

  return mergeCellShapeGrids(grids);
}
