import type { Node, Edge } from "@xyflow/react";
import { getNodeType } from "../density/evalTypes";
import {
  getShapePreviewProfile,
  isCellNoiseType,
  isSdfType,
  supportsShapePreviewCard,
} from "./shapePreviewProfile";
import { resolveShapePreviewMeshNodeId } from "./resolveShapePreviewMesh";
import { SHAPE_PREVIEW_COMBINER_TYPES } from "./combinerShapePreview";
import { isLikelyOriginCenteredSdfVoxelRange } from "./sdfPreviewDefaults";
import { getShapePreviewModeHint } from "./previewModeRouting";

export interface ShapePreviewHint {
  tone: "info" | "warning";
  message: string;
}

export function getShapePreviewHints(
  nodes: Node[],
  edges: Edge[],
  previewTargetId: string | null,
  outputNodeId: string | null,
  layers: {
    showShapePreview: boolean;
    showCellBoundaries: boolean;
    showWallDistance: boolean;
    showMeshSamples: boolean;
    showSdfSurface: boolean;
  },
  voxel?: { yMin: number; yMax: number; mode: string },
): ShapePreviewHint[] {
  if (!layers.showShapePreview) {
    return [{
      tone: "info",
      message: "Click a PCN, mesh, or SDF node on the graph to preview its shape, then enable layers here.",
    }];
  }

  const target = previewTargetId
    ? nodes.find((n) => n.id === previewTargetId)
    : outputNodeId
      ? nodes.find((n) => n.id === outputNodeId)
      : null;

  if (!target) {
    return [{
      tone: "warning",
      message: "Set Preview Target to a node (or click a node on the graph). Auto uses the biome output.",
    }];
  }

  const type = getNodeType(target);
  const profile = getShapePreviewProfile(type);
  const hints: ShapePreviewHint[] = [];

  const modeHint = getShapePreviewModeHint(type);
  if (
    modeHint &&
    voxel &&
    voxel.mode !== modeHint.recommended &&
    (profile.cells || profile.mesh)
  ) {
    hints.push({ tone: "warning", message: modeHint.reason });
  }

  if (SHAPE_PREVIEW_COMBINER_TYPES.has(type)) {
    hints.push({
      tone: "info",
      message:
        "Combiner heatmap with merged upstream cell walls when Cell boundaries / Wall distance are on. Pick a single CellNoise2D child for one layer only, or an SDF node for the pink zero contour.",
    });
  }

  if (!supportsShapePreviewCard(type) && !SHAPE_PREVIEW_COMBINER_TYPES.has(type)) {
    hints.push({
      tone: "warning",
      message: `Preview target is ${type}. Pick PositionsCellNoise, Mesh2D/3D, or a Shape SDF for shape layers.`,
    });
    return hints;
  }

  if (
    (layers.showCellBoundaries || layers.showWallDistance) &&
    !profile.cells &&
    !SHAPE_PREVIEW_COMBINER_TYPES.has(type)
  ) {
    hints.push({
      tone: "warning",
      message: "Cell layers need a PCN or CellNoise node as the preview target.",
    });
  }

  if (layers.showSdfSurface && !profile.sdfZero) {
    hints.push({
      tone: "warning",
      message: "SDF surface needs an Ellipsoid, Cuboid, Cylinder, Plane, Shell, or Cube as the preview target.",
    });
  }

  if (layers.showMeshSamples) {
    const meshId = resolveShapePreviewMeshNodeId(nodes, edges, target.id);
    if (!meshId) {
      if (isCellNoiseType(type)) {
        hints.push({
          tone: "warning",
          message: "Connect Mesh2D or Mesh3D to this PCN's Positions input to see mesh samples.",
        });
      } else {
        hints.push({
          tone: "info",
          message: "No mesh points in range. Check Resolution / range or wire a position provider.",
        });
      }
    }
  }

  if (isSdfType(type) && layers.showSdfSurface) {
    if (
      voxel &&
      (voxel.mode === "voxel" || voxel.mode === "world") &&
      isLikelyOriginCenteredSdfVoxelRange(voxel.yMin, voxel.yMax)
    ) {
      hints.push({
        tone: "warning",
        message:
          "Voxel Y min is above the shape center — you may only see a flat disk. Set Y min negative (e.g. −32) or use the SDF only preset.",
      });
    } else {
      hints.push({
        tone: "info",
        message:
          "SDF surface is the density=0 isocontour. In voxel mode the pink line uses the same 3D volume as the mesh; adjust SDF slice Y or voxel Y min/max around the shape center.",
      });
    }
  }

  if (hints.length === 0) {
    hints.push({
      tone: "info",
      message: `Showing shape layers for ${type}. White lines = cell walls, cyan = near walls, amber = mesh, pink = SDF surface.`,
    });
  }

  return hints;
}
