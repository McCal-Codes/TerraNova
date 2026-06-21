import type { Node } from "@xyflow/react";
import { NODE_HEIGHT, NODE_WIDTH } from "@/constants";
import {
  annotationNodeSize,
  isAnnotationNode,
  syncAnnotationNodeDimensions,
} from "@/utils/annotationUtils";

export const VIEWPORT_MARGIN = 48;
export const HYALE_LAYOUT_COVERAGE_THRESHOLD = 0.5;
const MIN_ANNOTATION_SIZE = 48;
/** Target gap between typical Hytale neighbors on the TerraNova canvas. */
const TARGET_NEIGHBOR_GAP = NODE_WIDTH + 36;
/** Minimum gap required between the closest pair of nodes. */
const MIN_NODE_CLEARANCE = NODE_WIDTH + 20;

export type ImportLayoutMode = "hytale" | "autolayout" | "placeholder";

export interface LayoutOffset {
  /** Legacy translate subtracted on export when origin/scale are absent. */
  x: number;
  y: number;
  /** Hytale-space origin used with scale (top-left of graph bbox). */
  originX?: number;
  originY?: number;
  /** Canvas pixels per Hytale unit. May be > 1 when Hytale spacing is tighter than TerraNova nodes. */
  scale?: number;
}

/** Resolve the Hytale $NodeId used in $NodeEditorMetadata.$Nodes. */
export function resolveNodeHytaleId(node: Node): string {
  const data = node.data as { __hytaleNodeId?: string } | undefined;
  return data?.__hytaleNodeId ?? node.id;
}

function usesScaledTransform(offset: LayoutOffset): boolean {
  return offset.originX != null && offset.originY != null;
}

/** True when a section offset can round-trip through global Hytale coordinates. */
export function isValidHytaleLayoutTransform(offset: LayoutOffset): boolean {
  return usesScaledTransform(offset) && (offset.scale ?? 0) > 0;
}

/** Target max span for the unified biome overview canvas. */
export const OVERVIEW_LAYOUT_TARGET_SPAN = 5600;

/** Map a Hytale editor coordinate into normalized TerraNova canvas space. */
export function hytaleToCanvasPosition(
  hytaleX: number,
  hytaleY: number,
  transform: LayoutOffset,
): { x: number; y: number } {
  if (usesScaledTransform(transform)) {
    const scale = transform.scale ?? 1;
    return {
      x: VIEWPORT_MARGIN + (hytaleX - transform.originX!) * scale,
      y: VIEWPORT_MARGIN + (hytaleY - transform.originY!) * scale,
    };
  }
  return {
    x: hytaleX + transform.x,
    y: hytaleY + transform.y,
  };
}

/** Restore a canvas coordinate to global Hytale editor space. */
export function canvasToHytalePosition(
  canvasX: number,
  canvasY: number,
  transform: LayoutOffset,
): { x: number; y: number } {
  if (usesScaledTransform(transform)) {
    const scale = transform.scale ?? 1;
    return {
      x: transform.originX! + (canvasX - VIEWPORT_MARGIN) / scale,
      y: transform.originY! + (canvasY - VIEWPORT_MARGIN) / scale,
    };
  }
  return { x: canvasX - transform.x, y: canvasY - transform.y };
}

function nearestNeighborDistances(coords: { x: number; y: number }[]): number[] {
  const distances: number[] = [];
  for (let i = 0; i < coords.length; i++) {
    let best = Infinity;
    for (let j = 0; j < coords.length; j++) {
      if (i === j) continue;
      best = Math.min(best, Math.hypot(coords[i].x - coords[j].x, coords[i].y - coords[j].y));
    }
    if (Number.isFinite(best)) distances.push(best);
  }
  return distances;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Scale Hytale editor units to TerraNova node size.
 * Uses nearest-neighbor spacing — never the full-graph bbox — so tight clusters
 * are not crushed when the biome spans a huge canvas in Hytale.
 */
export function computeHytaleLayoutScale(coords: { x: number; y: number }[]): number {
  if (coords.length < 2) return 1;

  const nn = nearestNeighborDistances(coords);
  const minNearest = Math.min(...nn);
  const medianNearest = median(nn);
  if (minNearest <= 0 || medianNearest <= 0) return 1;

  const targetScale = TARGET_NEIGHBOR_GAP / medianNearest;
  const clearanceScale = MIN_NODE_CLEARANCE / minNearest;
  return Math.max(targetScale, clearanceScale);
}

/**
 * One transform for the whole biome overview — fits all sections on one canvas.
 * Uses full-graph span for macro layout; per-section tabs keep neighbor-based scale.
 */
export function computeOverviewLayoutTransform(
  globalCoords: { x: number; y: number }[],
): LayoutOffset {
  if (globalCoords.length === 0) {
    return { x: 0, y: 0, originX: 0, originY: 0, scale: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const coord of globalCoords) {
    minX = Math.min(minX, coord.x);
    minY = Math.min(minY, coord.y);
    maxX = Math.max(maxX, coord.x + NODE_WIDTH);
    maxY = Math.max(maxY, coord.y + NODE_HEIGHT);
  }

  const span = Math.max(maxX - minX, maxY - minY, NODE_WIDTH);
  const scale = span > OVERVIEW_LAYOUT_TARGET_SPAN
    ? OVERVIEW_LAYOUT_TARGET_SPAN / span
    : computeHytaleLayoutScale(globalCoords);

  return {
    x: VIEWPORT_MARGIN - minX,
    y: VIEWPORT_MARGIN - minY,
    originX: minX,
    originY: minY,
    scale,
  };
}

/** Fraction of graph nodes with a matching Hytale metadata position (optionally scoped to a section). */
export function computePositionCoverage(
  graphNodes: Node[],
  nodePositions: Record<string, { x: number; y: number }>,
  sectionNodeIds?: Set<string>,
): number {
  if (graphNodes.length === 0) return 0;

  let matched = 0;
  let considered = 0;
  for (const node of graphNodes) {
    const id = resolveNodeHytaleId(node);
    if (sectionNodeIds && sectionNodeIds.size > 0 && !sectionNodeIds.has(id)) continue;
    considered++;
    if (id in nodePositions) matched++;
  }

  return considered === 0 ? 0 : matched / considered;
}

export function shouldUseHytaleImportLayout(
  _autoLayoutOnOpen: boolean,
  nodePositions: Record<string, { x: number; y: number }>,
  graphNodes: Node[],
  sectionNodeIds?: Set<string>,
): boolean {
  if (Object.keys(nodePositions).length === 0) return false;
  return computePositionCoverage(graphNodes, nodePositions, sectionNodeIds)
    >= HYALE_LAYOUT_COVERAGE_THRESHOLD;
}

/** True when a file carries enough Hytale $Nodes positions to preserve editor layout on open. */
export function fileHasHytaleLayoutPositions(
  nodePositions: Record<string, { x: number; y: number }> | null | undefined,
  minPositions = 4,
): boolean {
  return Object.keys(nodePositions ?? {}).length >= minPositions;
}

export interface ApplySectionHytalePositionsResult {
  nodes: Node[];
  offset: LayoutOffset;
  coverage: number;
  usedHytaleLayout: boolean;
}

/**
 * Apply Hytale $Nodes positions to a section graph, scale to TerraNova node size,
 * and normalize to a friendly viewport origin.
 */
export function applySectionHytalePositions(
  nodes: Node[],
  nodePositions: Record<string, { x: number; y: number }>,
  sectionNodeIds?: Set<string>,
): ApplySectionHytalePositionsResult {
  const graphNodes = nodes.filter((n) => !isAnnotationNode(n));
  const coverage = computePositionCoverage(graphNodes, nodePositions, sectionNodeIds);

  if (coverage < HYALE_LAYOUT_COVERAGE_THRESHOLD) {
    return { nodes, offset: { x: 0, y: 0 }, coverage, usedHytaleLayout: false };
  }

  const positionedCoords: { x: number; y: number }[] = [];
  let minX = Infinity;
  let minY = Infinity;

  for (const node of graphNodes) {
    const id = resolveNodeHytaleId(node);
    const pos = nodePositions[id];
    if (!pos || (sectionNodeIds && sectionNodeIds.size > 0 && !sectionNodeIds.has(id))) continue;
    positionedCoords.push(pos);
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { nodes, offset: { x: 0, y: 0 }, coverage, usedHytaleLayout: false };
  }

  const scale = computeHytaleLayoutScale(positionedCoords);
  const transform: LayoutOffset = {
    x: VIEWPORT_MARGIN - minX,
    y: VIEWPORT_MARGIN - minY,
    originX: minX,
    originY: minY,
    scale,
  };

  const normalized = nodes.map((node) => {
    if (isAnnotationNode(node)) return node;

    const id = resolveNodeHytaleId(node);
    const inSection = !sectionNodeIds || sectionNodeIds.size === 0 || sectionNodeIds.has(id);
    const pos = inSection ? nodePositions[id] : undefined;
    if (!pos) return node;

    return {
      ...node,
      position: hytaleToCanvasPosition(pos.x, pos.y, transform),
    };
  });

  return {
    nodes: normalized,
    offset: transform,
    coverage,
    usedHytaleLayout: true,
  };
}

/** Map imported comment/frame geometry onto the compacted section layout. */
export function applySectionAnnotationPositions(
  annotationNodes: Node[],
  transform: LayoutOffset,
): Node[] {
  const scale = transform.scale ?? 1;

  return annotationNodes.map((node) => {
    const size = annotationNodeSize(node);
    const position = hytaleToCanvasPosition(node.position.x, node.position.y, transform);

    if (scale === 1 && !usesScaledTransform(transform)) {
      return { ...node, position };
    }

    const scaledWidth = Math.max(MIN_ANNOTATION_SIZE, Math.round(size.width * scale));
    const scaledHeight = Math.max(MIN_ANNOTATION_SIZE, Math.round(size.height * scale));

    return syncAnnotationNodeDimensions({
      ...node,
      position,
      data: {
        ...(node.data as object),
        width: scaledWidth,
        height: scaledHeight,
      },
    });
  });
}

/** Restore global Hytale coordinates from normalized canvas positions on export. */
export function restoreGlobalHytalePositions(
  nodes: Node[],
  transform: LayoutOffset,
): Node[] {
  if (transform.x === 0 && transform.y === 0 && !usesScaledTransform(transform)) return nodes;

  return nodes.map((node) => {
    const hytale = canvasToHytalePosition(node.position.x, node.position.y, transform);
    if (!isAnnotationNode(node) || (transform.scale ?? 1) === 1) {
      return { ...node, position: hytale };
    }

    const size = annotationNodeSize(node);
    const scale = transform.scale ?? 1;
    return syncAnnotationNodeDimensions({
      ...node,
      position: hytale,
      data: {
        ...(node.data as object),
        width: Math.max(MIN_ANNOTATION_SIZE, Math.round(size.width / scale)),
        height: Math.max(MIN_ANNOTATION_SIZE, Math.round(size.height / scale)),
      },
    });
  });
}
