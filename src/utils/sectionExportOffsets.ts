import type { Node } from "@xyflow/react";
import { NODE_HEIGHT, NODE_WIDTH } from "@/constants";
import { annotationNodeSize, isGraphNode } from "@/utils/annotationUtils";
import {
  restoreGlobalHytalePositions,
  type ImportLayoutMode,
  type LayoutOffset,
} from "@/utils/applyHytaleImportLayout";
import { biomeSectionSortOrder } from "@/utils/sectionAnnotationRouting";
import { sanitizeGraphNodesAndEdges } from "@/utils/sanitizeGraphNodes";

const SECTION_STACK_GAP = 420;

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function nodeSize(node: Node): { width: number; height: number } {
  if (!node) return { width: NODE_WIDTH, height: NODE_HEIGHT };
  if (isGraphNode(node)) {
    return { width: NODE_WIDTH, height: NODE_HEIGHT };
  }
  return annotationNodeSize(node);
}

function computeNodesBBox(nodes: Node[]): BBox | null {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    if (!node?.position) continue;
    const { width, height } = nodeSize(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Stack per-section canvas nodes into one metadata coordinate space for Hytale export.
 * TerraNova tabs use separate local layouts; Hytale stores one $NodeEditorMetadata block.
 */
export function stackBiomeSectionNodesForExport(
  sectionNodes: Record<string, Node[]>,
): Node[] {
  const order = biomeSectionSortOrder(Object.keys(sectionNodes));
  const stacked: Node[] = [];
  let yCursor: number | null = null;

  for (const sectionKey of order) {
    const { nodes } = sanitizeGraphNodesAndEdges(sectionNodes[sectionKey] ?? [], []);
    if (nodes.length === 0) continue;

    const bbox = computeNodesBBox(nodes);
    if (!bbox) continue;

    if (yCursor === null) {
      // First section: preserve absolute canvas coordinates (per-tab local origin).
      for (const node of nodes) {
        if (!node) continue;
        stacked.push(node);
      }
      yCursor = bbox.maxY + SECTION_STACK_GAP;
      continue;
    }

    const offsetY = yCursor - bbox.minY;
    for (const node of nodes) {
      if (!node?.position) continue;
      stacked.push({
        ...node,
        position: {
          x: node.position.x,
          y: node.position.y + offsetY,
        },
      });
    }

    yCursor += (bbox.maxY - bbox.minY) + SECTION_STACK_GAP;
  }

  return stacked;
}

/**
 * Merge per-section canvas nodes into one Hytale metadata coordinate space
 * by restoring the import-time normalization offsets (no vertical stacking).
 */
export function mergeBiomeSectionNodesForHytaleExport(
  sectionNodes: Record<string, Node[]>,
  offsets: Record<string, LayoutOffset>,
): Node[] {
  const order = biomeSectionSortOrder(Object.keys(sectionNodes));
  const merged: Node[] = [];

  for (const sectionKey of order) {
    const { nodes } = sanitizeGraphNodesAndEdges(sectionNodes[sectionKey] ?? [], []);
    if (nodes.length === 0) continue;
    const offset = offsets[sectionKey] ?? { x: 0, y: 0 };
    merged.push(...restoreGlobalHytalePositions(nodes, offset));
  }

  return merged;
}

/**
 * Pick stacked or global merge based on how the biome was imported.
 */
export function prepareBiomeSectionNodesForExport(
  sectionNodes: Record<string, Node[]>,
  importLayoutMode: ImportLayoutMode | null | undefined,
  hytaleLayoutOffsets?: Record<string, LayoutOffset> | null,
): Node[] {
  if (importLayoutMode === "hytale" && hytaleLayoutOffsets) {
    return mergeBiomeSectionNodesForHytaleExport(sectionNodes, hytaleLayoutOffsets);
  }
  return stackBiomeSectionNodesForExport(sectionNodes);
}
