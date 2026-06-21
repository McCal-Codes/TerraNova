import type { Node, Edge } from "@xyflow/react";

import { NODE_HEIGHT, NODE_WIDTH } from "@/constants";

import {

  computeOverviewLayoutTransform,

  hytaleToCanvasPosition,

  isValidHytaleLayoutTransform,

  restoreGlobalHytalePositions,

  resolveNodeHytaleId,

  type ImportLayoutMode,

  type LayoutOffset,

} from "@/utils/applyHytaleImportLayout";

import { annotationNodeSize, isAnnotationNode, isGraphNode, syncAnnotationNodeDimensions } from "@/utils/annotationUtils";

import { biomeSectionSortOrder } from "@/utils/sectionAnnotationRouting";

import type { BiomeSectionData } from "@/stores/slices/types";

import { getBiomeSectionColor, getBiomeSectionLabel } from "@/utils/biomeSectionUtils";



export interface BiomeOverviewGraph {

  nodes: Node[];

  edges: Edge[];

}



const SECTION_STACK_GAP = 320;

const OVERVIEW_BACKDROP_PAD = 36;

const OVERVIEW_SECTION_GAP = 96;

const MAX_DECONGEST_ITERATIONS = 64;

const MIN_ANNOTATION_SIZE = 48;

export interface BiomeOverviewBuildOptions {
  originalWrapper?: Record<string, unknown> | null;
  nodePositions?: Record<string, { x: number; y: number }> | null;
}

interface OverviewSectionSlice {
  sectionKey: string;
  nodes: Node[];
  edges: Edge[];
}

interface SectionRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface SectionAnchorSpec {
  nodeId: string;
  label: string;
  sectionKey: string;
}

function collectSectionAnchorSpecs(
  wrapper: Record<string, unknown>,
  biomeSections: Record<string, BiomeSectionData>,
): SectionAnchorSpec[] {
  const anchors: SectionAnchorSpec[] = [];

  const wrapperNodeId =
  typeof wrapper.$NodeId === "string"
    ? wrapper.$NodeId
    : typeof wrapper.__hytaleNodeId === "string"
      ? wrapper.__hytaleNodeId
      : null;
  if (wrapperNodeId) {
    anchors.push({ nodeId: wrapperNodeId, label: "[ROOT] Biome", sectionKey: "Terrain" });
  }

  const terrain = wrapper.Terrain as Record<string, unknown> | undefined;
  const terrainNodeId =
    typeof terrain?.$NodeId === "string"
      ? terrain.$NodeId
      : typeof terrain?.__hytaleNodeId === "string"
        ? terrain.__hytaleNodeId
        : null;
  if (terrainNodeId) {
    anchors.push({ nodeId: terrainNodeId, label: "Terrain", sectionKey: "Terrain" });
  }

  if (Array.isArray(wrapper.Props)) {
    for (let i = 0; i < wrapper.Props.length; i++) {
      const sectionKey = `Props[${i}]`;
      if (!biomeSections[sectionKey]) continue;
      const prop = wrapper.Props[i] as Record<string, unknown>;
      const runtimeId =
        typeof prop.$NodeId === "string"
          ? prop.$NodeId
          : typeof prop.__hytaleNodeId === "string"
            ? prop.__hytaleNodeId
            : null;
      if (runtimeId) {
        anchors.push({ nodeId: runtimeId, label: "Runtime", sectionKey });
      }
      const dist = prop.PropDistribution as Record<string, unknown> | undefined;
      const distId =
        typeof dist?.$NodeId === "string"
          ? dist.$NodeId
          : typeof dist?.__hytaleNodeId === "string"
            ? dist.__hytaleNodeId
            : null;
      if (distId) {
        anchors.push({ nodeId: distId, label: "PropDistribution", sectionKey });
      }
    }
  }

  const env = wrapper.EnvironmentProvider as Record<string, unknown> | undefined;
  const envId =
    typeof env?.$NodeId === "string"
      ? env.$NodeId
      : typeof env?.__hytaleNodeId === "string"
        ? env.__hytaleNodeId
        : null;
  if (envId && biomeSections.EnvironmentProvider) {
    anchors.push({ nodeId: envId, label: "Atmosphere", sectionKey: "EnvironmentProvider" });
  }

  const tint = wrapper.TintProvider as Record<string, unknown> | undefined;
  const tintId =
    typeof tint?.$NodeId === "string"
      ? tint.$NodeId
      : typeof tint?.__hytaleNodeId === "string"
        ? tint.__hytaleNodeId
        : null;
  if (tintId && biomeSections.TintProvider) {
    anchors.push({ nodeId: tintId, label: "Tint", sectionKey: "TintProvider" });
  }

  return anchors;
}

function anchorAlreadyInSectionGraph(
  anchorNodeId: string,
  biomeSections: Record<string, BiomeSectionData>,
): boolean {
  for (const section of Object.values(biomeSections)) {
    for (const node of section.nodes) {
      if (node.id === anchorNodeId) return true;
      if (resolveNodeHytaleId(node) === anchorNodeId) return true;
    }
  }
  return false;
}

function injectSectionAnchorNodes(
  allNodes: Node[],
  biomeSections: Record<string, BiomeSectionData>,
  order: string[],
  offsets: Record<string, LayoutOffset>,
  importLayoutMode: ImportLayoutMode | null,
  nodePositions: Record<string, { x: number; y: number }> | null | undefined,
  originalWrapper: Record<string, unknown> | null | undefined,
  sectionShifts?: Record<string, { dx: number; dy: number }>,
): void {
  if (importLayoutMode !== "hytale" || !nodePositions || !originalWrapper) return;
  if (!canUseGlobalOverviewLayout(biomeSections, order, importLayoutMode, offsets)) return;

  const globalCoords = collectGlobalGraphCoords(biomeSections, order, offsets);
  const overviewTransform = computeOverviewLayoutTransform(globalCoords);
  const anchors = collectSectionAnchorSpecs(originalWrapper, biomeSections);

  for (const anchor of anchors) {
    if (anchorAlreadyInSectionGraph(anchor.nodeId, biomeSections)) continue;
    const pos = nodePositions[anchor.nodeId];
    if (!pos) continue;

    const canvasPos = hytaleToCanvasPosition(pos.x, pos.y, overviewTransform);
    const shift = sectionShifts?.[anchor.sectionKey];
    const position = shift
      ? { x: canvasPos.x + shift.dx, y: canvasPos.y + shift.dy }
      : canvasPos;

    allNodes.push({
      id: `anchor::${anchor.sectionKey}::${anchor.nodeId}`,
      type: "sectionAnchor",
      position,
      data: {
        label: anchor.label,
        sectionKey: anchor.sectionKey,
        anchorKind: anchor.label,
        _readOnlyOverview: true,
      },
      draggable: false,
      selectable: true,
      connectable: false,
      zIndex: 12,
    });
  }
}



function nodeSize(node: Node): { width: number; height: number } {

  if (isGraphNode(node)) return { width: NODE_WIDTH, height: NODE_HEIGHT };

  return annotationNodeSize(node);

}



function sectionBBox(nodes: Node[]) {

  let minX = Infinity;

  let minY = Infinity;

  let maxX = -Infinity;

  let maxY = -Infinity;

  for (const node of nodes) {

    const { width, height } = nodeSize(node);

    minX = Math.min(minX, node.position.x);

    minY = Math.min(minY, node.position.y);

    maxX = Math.max(maxX, node.position.x + width);

    maxY = Math.max(maxY, node.position.y + height);

  }

  if (!Number.isFinite(minX)) return null;

  return { minX, minY, maxX, maxY };

}



function prefixSectionGraph(

  sectionKey: string,

  nodes: Node[],

  edges: Edge[],

): BiomeOverviewGraph {

  const prefix = `${sectionKey}::`;

  const idMap = new Map<string, string>();



  const prefixedNodes = nodes.map((node) => {

    const newId = `${prefix}${node.id}`;

    idMap.set(node.id, newId);

    return {

      ...node,

      id: newId,

      draggable: false,

      selectable: true,

      data: {

        ...(node.data as object),

        _overviewSection: sectionKey,

        _originalNodeId: node.id,

        _readOnlyOverview: true,

      },

    };

  });



  const prefixedEdges = edges.map((edge) => ({

    ...edge,

    id: `${prefix}${edge.id}`,

    source: idMap.get(edge.source) ?? edge.source,

    target: idMap.get(edge.target) ?? edge.target,

  }));



  return { nodes: prefixedNodes, edges: prefixedEdges };

}



function createSectionBackdrop(sectionKey: string, nodes: Node[]): Node | null {

  const contentNodes = nodes.filter((n) => n.type !== "overviewSection");

  const bbox = sectionBBox(contentNodes);

  if (!bbox) return null;



  const width = bbox.maxX - bbox.minX + OVERVIEW_BACKDROP_PAD * 2;

  const height = bbox.maxY - bbox.minY + OVERVIEW_BACKDROP_PAD * 2;



  return {

    id: `${sectionKey}::__backdrop`,

    type: "overviewSection",

    position: { x: bbox.minX - OVERVIEW_BACKDROP_PAD, y: bbox.minY - OVERVIEW_BACKDROP_PAD },

    data: {

      label: getBiomeSectionLabel(sectionKey),

      color: getBiomeSectionColor(sectionKey),

      width,

      height,

    },

    draggable: false,

    selectable: false,

    connectable: false,

    zIndex: -20,

    style: { pointerEvents: "none" },

  };

}



function transformSectionToOverviewCanvas(

  nodes: Node[],

  sectionTransform: LayoutOffset,

  overviewTransform: LayoutOffset,

): Node[] {

  const globalNodes = restoreGlobalHytalePositions(nodes, sectionTransform);

  const overviewScale = overviewTransform.scale ?? 1;



  return globalNodes.map((node) => {

    const position = hytaleToCanvasPosition(node.position.x, node.position.y, overviewTransform);

    if (!isAnnotationNode(node)) {

      return { ...node, position };

    }



    const size = annotationNodeSize(node);

    return syncAnnotationNodeDimensions({

      ...node,

      position,

      data: {

        ...(node.data as object),

        width: Math.max(MIN_ANNOTATION_SIZE, Math.round(size.width * overviewScale)),

        height: Math.max(MIN_ANNOTATION_SIZE, Math.round(size.height * overviewScale)),

      },

    });

  });

}



function collectGlobalGraphCoords(

  biomeSections: Record<string, BiomeSectionData>,

  order: string[],

  offsets: Record<string, LayoutOffset>,

): { x: number; y: number }[] {

  const coords: { x: number; y: number }[] = [];

  for (const sectionKey of order) {

    const section = biomeSections[sectionKey];

    if (!section || section.nodes.length === 0) continue;

    const sectionTransform = offsets[sectionKey];

    if (!sectionTransform || !isValidHytaleLayoutTransform(sectionTransform)) continue;



    const globalNodes = restoreGlobalHytalePositions(section.nodes, sectionTransform);

    for (const node of globalNodes) {

      if (isGraphNode(node)) coords.push(node.position);

    }

  }

  return coords;

}



function canUseGlobalOverviewLayout(

  biomeSections: Record<string, BiomeSectionData>,

  order: string[],

  importLayoutMode: ImportLayoutMode | null,

  offsets: Record<string, LayoutOffset>,

): boolean {

  if (importLayoutMode !== "hytale") return false;



  let hasGraphNodes = false;

  for (const sectionKey of order) {

    const section = biomeSections[sectionKey];

    if (!section || section.nodes.length === 0) continue;

    hasGraphNodes = true;

    const sectionTransform = offsets[sectionKey];

    if (!sectionTransform || !isValidHytaleLayoutTransform(sectionTransform)) {

      return false;

    }

  }

  return hasGraphNodes;

}



function separationShift(fixed: SectionRect, moving: SectionRect, gap: number): { dx: number; dy: number } | null {
  const overlapX = Math.min(fixed.maxX, moving.maxX) - Math.max(fixed.minX, moving.minX);
  const overlapY = Math.min(fixed.maxY, moving.maxY) - Math.max(fixed.minY, moving.minY);
  if (overlapX <= 0 || overlapY <= 0) return null;

  const fixedCx = (fixed.minX + fixed.maxX) / 2;
  const fixedCy = (fixed.minY + fixed.maxY) / 2;
  const movingCx = (moving.minX + moving.maxX) / 2;
  const movingCy = (moving.minY + moving.maxY) / 2;

  if (overlapX < overlapY) {
    return { dx: (overlapX + gap) * (movingCx < fixedCx ? -1 : 1), dy: 0 };
  }
  return { dx: 0, dy: (overlapY + gap) * (movingCy < fixedCy ? -1 : 1) };
}

function shiftSectionSlice(slice: OverviewSectionSlice, dx: number, dy: number): OverviewSectionSlice {
  if (dx === 0 && dy === 0) return slice;
  return {
    ...slice,
    nodes: slice.nodes.map((node) => ({
      ...node,
      position: { x: node.position.x + dx, y: node.position.y + dy },
    })),
  };
}

function sectionLayoutRect(nodes: Node[]): SectionRect | null {
  const bbox = sectionBBox(nodes);
  if (!bbox) return null;
  return {
    minX: bbox.minX - OVERVIEW_BACKDROP_PAD,
    minY: bbox.minY - OVERVIEW_BACKDROP_PAD,
    maxX: bbox.maxX + OVERVIEW_BACKDROP_PAD,
    maxY: bbox.maxY + OVERVIEW_BACKDROP_PAD,
  };
}

function applySliceShift(
  placed: Array<{ slice: OverviewSectionSlice; bbox: SectionRect }>,
  index: number,
  dx: number,
  dy: number,
): void {
  if (dx === 0 && dy === 0) return;
  const entry = placed[index];
  entry.slice = shiftSectionSlice(entry.slice, dx, dy);
  entry.bbox = {
    minX: entry.bbox.minX + dx,
    minY: entry.bbox.minY + dy,
    maxX: entry.bbox.maxX + dx,
    maxY: entry.bbox.maxY + dy,
  };
}

/** Push apart overlapping section graphs while preserving each section's internal layout. */
function decongestOverviewSectionSlices(slices: OverviewSectionSlice[]): {
  slices: OverviewSectionSlice[];
  shifts: Record<string, { dx: number; dy: number }>;
} {
  if (slices.length <= 1) return { slices, shifts: {} };

  const items = slices
    .map((slice) => ({ slice, bbox: sectionLayoutRect(slice.nodes) }))
    .filter((item): item is { slice: OverviewSectionSlice; bbox: SectionRect } => item.bbox != null);

  items.sort((a, b) => a.bbox.minY - b.bbox.minY || a.bbox.minX - b.bbox.minX);

  const placed: Array<{ slice: OverviewSectionSlice; bbox: SectionRect }> = [];
  const originByKey = new Map(items.map((item) => [item.slice.sectionKey, { ...item.bbox }]));

  for (const item of items) {
    let bbox = { ...item.bbox };
    let totalDx = 0;
    let totalDy = 0;

    for (let iter = 0; iter < MAX_DECONGEST_ITERATIONS; iter++) {
      let moved = false;
      for (const other of placed) {
        const sep = separationShift(other.bbox, bbox, OVERVIEW_SECTION_GAP);
        if (!sep) continue;
        totalDx += sep.dx;
        totalDy += sep.dy;
        bbox = {
          minX: bbox.minX + sep.dx,
          minY: bbox.minY + sep.dy,
          maxX: bbox.maxX + sep.dx,
          maxY: bbox.maxY + sep.dy,
        };
        moved = true;
      }
      if (!moved) break;
    }

    placed.push({
      slice: shiftSectionSlice(item.slice, totalDx, totalDy),
      bbox,
    });
  }

  for (let iter = 0; iter < MAX_DECONGEST_ITERATIONS; iter++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const sep = separationShift(placed[i].bbox, placed[j].bbox, OVERVIEW_SECTION_GAP);
        if (!sep) continue;
        applySliceShift(placed, j, sep.dx, sep.dy);
        moved = true;
      }
    }
    if (!moved) break;
  }

  const shifts: Record<string, { dx: number; dy: number }> = {};
  for (const entry of placed) {
    const origin = originByKey.get(entry.slice.sectionKey);
    if (!origin) continue;
    const dx = entry.bbox.minX - origin.minX;
    const dy = entry.bbox.minY - origin.minY;
    if (dx !== 0 || dy !== 0) {
      shifts[entry.slice.sectionKey] = { dx, dy };
    }
  }

  return { slices: placed.map((entry) => entry.slice), shifts };
}

function flattenOverviewSectionSlices(slices: OverviewSectionSlice[]): BiomeOverviewGraph {
  const allNodes: Node[] = [];
  const allEdges: Edge[] = [];

  for (const slice of slices) {
    const prefixed = prefixSectionGraph(slice.sectionKey, slice.nodes, slice.edges);
    const backdrop = createSectionBackdrop(slice.sectionKey, prefixed.nodes);
    if (backdrop) allNodes.push(backdrop);
    allNodes.push(...prefixed.nodes);
    allEdges.push(...prefixed.edges);
  }

  return { nodes: allNodes, edges: allEdges };
}

function positionSectionNodesForStackedOverview(

  nodes: Node[],

  yCursor: number | null,

): { nodes: Node[]; nextYCursor: number | null } {

  const bbox = sectionBBox(nodes);

  if (!bbox) return { nodes, nextYCursor: yCursor };



  if (yCursor === null) {

    return { nodes, nextYCursor: bbox.maxY + SECTION_STACK_GAP };

  }



  const shiftY = yCursor - bbox.minY;

  return {

    nodes: nodes.map((node) => ({

      ...node,

      position: { x: node.position.x, y: node.position.y + shiftY },

    })),

    nextYCursor: yCursor + (bbox.maxY - bbox.minY) + SECTION_STACK_GAP,

  };

}



/**

 * Assemble all biome section graphs into one read-only overview canvas.

 */

export function buildBiomeOverviewGraph(

  biomeSections: Record<string, BiomeSectionData>,

  importLayoutMode: ImportLayoutMode | null,

  hytaleLayoutOffsets: Record<string, LayoutOffset> | null,

  options?: BiomeOverviewBuildOptions,

): BiomeOverviewGraph {

  const order = biomeSectionSortOrder(Object.keys(biomeSections));

  const offsets = hytaleLayoutOffsets ?? {};



  if (canUseGlobalOverviewLayout(biomeSections, order, importLayoutMode, offsets)) {

    const globalCoords = collectGlobalGraphCoords(biomeSections, order, offsets);

    const overviewTransform = computeOverviewLayoutTransform(globalCoords);

    const slices: OverviewSectionSlice[] = [];



    for (const sectionKey of order) {

      const section = biomeSections[sectionKey];

      if (!section || section.nodes.length === 0) continue;



      const positioned = transformSectionToOverviewCanvas(

        section.nodes,

        offsets[sectionKey],

        overviewTransform,

      );

      slices.push({ sectionKey, nodes: positioned, edges: section.edges });

    }



    const { slices: separated, shifts } = decongestOverviewSectionSlices(slices);

    const graph = flattenOverviewSectionSlices(separated);

    injectSectionAnchorNodes(

      graph.nodes,

      biomeSections,

      order,

      offsets,

      importLayoutMode,

      options?.nodePositions,

      options?.originalWrapper,

      shifts,

    );



    return graph;

  }



  const stackedSlices: OverviewSectionSlice[] = [];

  let yCursor: number | null = null;

  for (const sectionKey of order) {

    const section = biomeSections[sectionKey];

    if (!section || section.nodes.length === 0) continue;



    const positioned = positionSectionNodesForStackedOverview(section.nodes, yCursor);

    yCursor = positioned.nextYCursor;

    stackedSlices.push({ sectionKey, nodes: positioned.nodes, edges: section.edges });

  }



  const { slices: separatedStacked } = decongestOverviewSectionSlices(stackedSlices);

  const stackedGraph = flattenOverviewSectionSlices(separatedStacked);

  return stackedGraph;

}



/** Jump from overview canvas to the owning section tab and node. */

export function resolveOverviewNodeNavigation(node: Node): {

  sectionKey: string;

  originalNodeId: string | null;

} | null {

  if (node.type === "sectionAnchor") {

    const sectionKey = (node.data as { sectionKey?: string }).sectionKey;

    if (!sectionKey) return null;

    return { sectionKey, originalNodeId: null };

  }

  const data = node.data as { _overviewSection?: string; _originalNodeId?: string } | undefined;

  if (!data?._overviewSection || !data._originalNodeId) return null;

  return { sectionKey: data._overviewSection, originalNodeId: data._originalNodeId };

}



export { resolveNodeHytaleId };


