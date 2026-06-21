import type { Node, Edge } from "@xyflow/react";
import { NODE_HEIGHT, NODE_WIDTH } from "@/constants";
import type { ImportMetadata } from "@/utils/hytaleToInternal";
import {
  applySectionAnnotationPositions,
  type ImportLayoutMode,
  type LayoutOffset,
} from "@/utils/applyHytaleImportLayout";
import {
  annotationNodeSize,
  buildFrameAroundNodes,
  isAnnotationNode,
  isGraphNode,
  layerCanvasNodes,
  syncAnnotationNodeDimensions,
} from "@/utils/annotationUtils";
import { resolveImportLayout, type ResolveImportLayoutOptions } from "@/utils/importLayout";

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const ANNOTATION_MARGIN = 48;
const MIN_ANNOTATION_SIZE = 48;

const SECTION_FRAME_TITLES: Record<string, string> = {
  Terrain: "Terrain",
  MaterialProvider: "Materials",
  EnvironmentProvider: "Environment",
  TintProvider: "Tint",
};

export interface AutoFrameImportOptions {
  sectionKey: string;
  propComment?: string;
  edges?: Edge[];
  sectionNodeIds?: Set<string>;
}

export interface MergeImportGraphResult {
  nodes: Node[];
  layoutMode: ImportLayoutMode;
  layoutOffset: LayoutOffset;
}

/** Turn a prop-layer $Comment into a short frame title. */
export function propCommentToFrameTitle(comment: string): string {
  const layerMatch = comment.match(/Prop layer\s+([^:]+)/i);
  if (layerMatch) return layerMatch[1].trim();
  const firstLine = comment.split("\n")[0]?.trim() ?? comment;
  return firstLine.length > 56 ? `${firstLine.slice(0, 53)}...` : firstLine;
}

export function resolveAutoFrameSectionTitle(sectionKey: string, propComment?: string): string {
  if (sectionKey.startsWith("Props[")) {
    if (propComment?.trim()) return propCommentToFrameTitle(propComment);
    const index = sectionKey.match(/Props\[(\d+)\]/)?.[1];
    return index != null ? `Props ${Number(index) + 1}` : "Props";
  }
  return SECTION_FRAME_TITLES[sectionKey] ?? sectionKey;
}

function computeBBox(
  nodes: Node[],
  sizeFor: (node: Node) => { width: number; height: number },
): BBox | null {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const { width, height } = sizeFor(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Map imported Hytale comment/frame geometry onto the auto-layouted graph.
 * Hytale metadata uses huge absolute coordinates and frame sizes (10³–10⁴ px).
 */
export function fitAnnotationNodesToGraph(graphNodes: Node[], annotationNodes: Node[]): Node[] {
  if (annotationNodes.length === 0) return [];
  if (graphNodes.length === 0) return annotationNodes;

  const graphBox = computeBBox(graphNodes, () => ({ width: NODE_WIDTH, height: NODE_HEIGHT }));
  const annotationBox = computeBBox(annotationNodes, annotationNodeSize);
  if (!graphBox || !annotationBox) return annotationNodes;

  const graphWidth = graphBox.maxX - graphBox.minX;
  const graphHeight = graphBox.maxY - graphBox.minY;
  const annotationWidth = annotationBox.maxX - annotationBox.minX;
  const annotationHeight = annotationBox.maxY - annotationBox.minY;

  if (annotationWidth <= 0 || annotationHeight <= 0) return annotationNodes;

  const scaleX = (graphWidth + ANNOTATION_MARGIN * 2) / annotationWidth;
  const scaleY = (graphHeight + ANNOTATION_MARGIN * 2) / annotationHeight;
  const scale = Math.min(scaleX, scaleY, 1);

  return annotationNodes.map((node) => {
    const size = annotationNodeSize(node);
    const relX = node.position.x - annotationBox.minX;
    const relY = node.position.y - annotationBox.minY;

    return {
      ...node,
      position: {
        x: graphBox.minX + ANNOTATION_MARGIN + relX * scale,
        y: graphBox.minY + ANNOTATION_MARGIN + relY * scale,
      },
      data: {
        ...(node.data as object),
        width: Math.max(MIN_ANNOTATION_SIZE, Math.round(size.width * scale)),
        height: Math.max(MIN_ANNOTATION_SIZE, Math.round(size.height * scale)),
      },
    };
  });
}

/** Build React Flow comment/frame nodes from Hytale $NodeEditorMetadata only. */
export function buildAnnotationNodesFromImportMetadata(
  metadata: ImportMetadata | null | undefined,
): Node[] {
  if (!metadata?.nodeEditorMetadata) return [];

  const nodes: Node[] = [];

  for (const comment of metadata.hytaleComments ?? []) {
    nodes.push({
      id: `comment-${crypto.randomUUID()}`,
      type: "comment",
      position: { x: comment.x, y: comment.y },
      data: {
        type: "comment",
        text: comment.text,
        width: comment.width,
        height: comment.height,
      },
      draggable: true,
      selectable: true,
      zIndex: 1,
    });
  }

  for (const group of metadata.hytaleGroups ?? []) {
    nodes.push(syncAnnotationNodeDimensions({
      id: `frame-${crypto.randomUUID()}`,
      type: "frame",
      position: { x: group.x, y: group.y },
      data: {
        type: "frame",
        name: group.name,
        width: group.width,
        height: group.height,
      },
      draggable: true,
      selectable: true,
      zIndex: -1,
    }));
  }

  return nodes;
}

export function hasImportAnnotations(metadata: ImportMetadata | null | undefined): boolean {
  if (!metadata?.nodeEditorMetadata) return false;
  return (metadata.hytaleComments?.length ?? 0) > 0 || (metadata.hytaleGroups?.length ?? 0) > 0;
}

function collectUpstreamNodeIds(rootId: string, edges: Edge[]): Set<string> {
  const result = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (result.has(current)) continue;
    result.add(current);
    for (const edge of edges) {
      if (edge.target === current && !result.has(edge.source)) {
        queue.push(edge.source);
      }
    }
  }
  return result;
}

function splitPropSectionSubgraphs(
  graphNodes: Node[],
  edges: Edge[],
): { name: string; nodes: Node[] }[] {
  const positionsRoot = graphNodes.find(
    (n) => (n.data as { _biomeField?: string })._biomeField === "Positions",
  );
  const assignmentsRoot = graphNodes.find(
    (n) => (n.data as { _biomeField?: string })._biomeField === "Assignments",
  );

  if (!positionsRoot && !assignmentsRoot) {
    return [];
  }

  const groups: { name: string; nodes: Node[] }[] = [];
  if (positionsRoot) {
    const ids = collectUpstreamNodeIds(positionsRoot.id, edges);
    const sub = graphNodes.filter((n) => ids.has(n.id));
    if (sub.length > 0) groups.push({ name: "Positions", nodes: sub });
  }
  if (assignmentsRoot) {
    const ids = collectUpstreamNodeIds(assignmentsRoot.id, edges);
    const sub = graphNodes.filter((n) => ids.has(n.id));
    if (sub.length > 0) groups.push({ name: "Assignments", nodes: sub });
  }

  return groups;
}

/**
 * When a file has no Hytale $Groups, wrap the layouted graph in section-sized frames.
 */
export function buildAutoFrameNodes(
  layoutedNodes: Node[],
  options: AutoFrameImportOptions,
): Node[] {
  const graphNodes = layoutedNodes.filter(isGraphNode);
  if (graphNodes.length === 0) return [];

  const sectionTitle = resolveAutoFrameSectionTitle(options.sectionKey, options.propComment);
  const frames: Node[] = [];

  if (options.sectionKey.startsWith("Props[") && options.edges?.length) {
    const subgroups = splitPropSectionSubgraphs(graphNodes, options.edges);
    if (subgroups.length > 1) {
      for (const group of subgroups) {
        const frame = buildFrameAroundNodes(group.nodes, `${sectionTitle} — ${group.name}`);
        if (frame) frames.push(frame);
      }
      return frames;
    }
  }

  const frame = buildFrameAroundNodes(graphNodes, sectionTitle);
  return frame ? [frame] : [];
}

export interface MergeImportGraphOptions extends ResolveImportLayoutOptions {
  autoFrame?: AutoFrameImportOptions;
}

/**
 * Layout graph nodes on import, then append comment/frame nodes.
 * Respects autoLayoutOnOpen and applies Hytale $Nodes positions when preserving layout.
 */
export async function mergeImportGraph(
  nodes: Node[],
  edges: Edge[],
  metadata: ImportMetadata | null | undefined,
  layoutOptions: MergeImportGraphOptions,
): Promise<MergeImportGraphResult> {
  const { autoFrame, ...resolveOptions } = layoutOptions;
  const { nodes: layouted, layoutMode, layoutOffset } = await resolveImportLayout(
    nodes,
    edges,
    resolveOptions,
  );
  const imported = buildAnnotationNodesFromImportMetadata(metadata);

  if (imported.length > 0) {
    const positioned = layoutMode === "hytale"
      ? applySectionAnnotationPositions(imported, layoutOffset)
      : fitAnnotationNodesToGraph(layouted, imported);
    return {
      nodes: layerCanvasNodes(layouted, positioned),
      layoutMode,
      layoutOffset,
    };
  }

  if (autoFrame) {
    const autoFrames = buildAutoFrameNodes(layouted, { ...autoFrame, edges });
    if (autoFrames.length > 0) {
      return {
        nodes: layerCanvasNodes(layouted, autoFrames),
        layoutMode,
        layoutOffset,
      };
    }
  }

  return { nodes: layouted, layoutMode, layoutOffset };
}

export { isAnnotationNode };
