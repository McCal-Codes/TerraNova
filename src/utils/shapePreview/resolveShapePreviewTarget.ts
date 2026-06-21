import type { Node, Edge } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";
import type { DensityExportMap } from "@/utils/densityExportRegistry";
import {
  findUpstreamCellNoiseNodes,
  SHAPE_PREVIEW_COMBINER_TYPES,
} from "./combinerShapePreview";
import { isCellNoiseType, supportsShapePreviewCard } from "./shapePreviewProfile";
import { resolveShapePreviewMeshNodeId } from "./resolveShapePreviewMesh";

export type ShapePreviewPreset = "pcn" | "pcnMesh" | "sdf";

export interface ShapePreviewTargetResolution {
  previewNodeId: string | null;
  outputNodeId: string | null;
  preset: ShapePreviewPreset;
  shapePreviewEnabled: boolean;
  /** Gallery / harness default when URL has no mode= */
  defaultPreviewMode: "2d" | "voxel";
}

function findFirst(nodes: Node[], type: string): Node | null {
  return nodes.find((n) => getNodeType(n) === type) ?? null;
}

function terrainOutputNode(nodes: Node[]): string | null {
  const mix = nodes.filter((n) => getNodeType(n) === "Mix");
  if (mix.length > 0) return mix[mix.length - 1]!.id;
  const max = findFirst(nodes, "Max");
  if (max) return max.id;
  const min = findFirst(nodes, "Min");
  if (min) return min.id;
  return nodes.length > 0 ? nodes[nodes.length - 1]!.id : null;
}

function isCellCapableTarget(
  nodes: Node[],
  edges: Edge[],
  nodeId: string,
  externalDensityExports?: DensityExportMap,
): boolean {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return false;
  const type = getNodeType(node);
  if (isCellNoiseType(type) || supportsShapePreviewCard(type)) return true;
  if (SHAPE_PREVIEW_COMBINER_TYPES.has(type)) {
    return findUpstreamCellNoiseNodes(nodes, edges, nodeId, 1, externalDensityExports).length > 0;
  }
  return false;
}

/**
 * Pick the best density preview target for shape overlays (PCN / cell walls / mesh).
 * Falls back to terrain output when no cell features are present.
 */
export function resolveShapePreviewTarget(
  nodes: Node[],
  edges: Edge[],
  options?: {
    explicitNodeId?: string | null;
    externalDensityExports?: DensityExportMap;
    /** When false, skip auto cell targeting (hydro / cave smoke cases). */
    preferShapePreview?: boolean;
  },
): ShapePreviewTargetResolution {
  const preferShape = options?.preferShapePreview !== false;
  const outputId = terrainOutputNode(nodes);

  if (!preferShape) {
    return {
      previewNodeId: outputId,
      outputNodeId: outputId,
      preset: "pcn",
      shapePreviewEnabled: false,
      defaultPreviewMode: "voxel",
    };
  }

  const explicit = options?.explicitNodeId?.trim();
  if (explicit && isCellCapableTarget(nodes, edges, explicit, options?.externalDensityExports)) {
    const node = nodes.find((n) => n.id === explicit)!;
    const type = getNodeType(node);
    const preset: ShapePreviewPreset =
      type === "PositionsCellNoise" || type === "Positions3D" ? "pcnMesh" : "pcn";
    return {
      previewNodeId: explicit,
      outputNodeId: outputId ?? explicit,
      preset,
      shapePreviewEnabled: true,
      defaultPreviewMode: "2d",
    };
  }

  const pcn = findFirst(nodes, "PositionsCellNoise") ?? findFirst(nodes, "Positions3D");
  if (pcn) {
    const meshId = resolveShapePreviewMeshNodeId(nodes, edges, pcn.id);
    return {
      previewNodeId: pcn.id,
      outputNodeId: outputId ?? pcn.id,
      preset: meshId ? "pcnMesh" : "pcn",
      shapePreviewEnabled: true,
      defaultPreviewMode: "2d",
    };
  }

  const combinerWithCells = nodes.find((n) => {
    const type = getNodeType(n);
    if (!SHAPE_PREVIEW_COMBINER_TYPES.has(type)) return false;
    return (
      findUpstreamCellNoiseNodes(nodes, edges, n.id, 1, options?.externalDensityExports).length > 0
    );
  });
  if (combinerWithCells) {
    return {
      previewNodeId: combinerWithCells.id,
      outputNodeId: outputId ?? combinerWithCells.id,
      preset: "pcn",
      shapePreviewEnabled: true,
      defaultPreviewMode: "2d",
    };
  }

  const cell2d = findFirst(nodes, "CellNoise2D") ?? findFirst(nodes, "CellNoise3D");
  if (cell2d) {
    return {
      previewNodeId: cell2d.id,
      outputNodeId: outputId ?? cell2d.id,
      preset: "pcn",
      shapePreviewEnabled: true,
      defaultPreviewMode: "2d",
    };
  }

  return {
    previewNodeId: outputId,
    outputNodeId: outputId,
    preset: "pcn",
    shapePreviewEnabled: false,
    defaultPreviewMode: "voxel",
  };
}
