import type { Node } from "@xyflow/react";
import { NODE_HEIGHT, NODE_WIDTH } from "@/constants";

const AUTHOR_NOTE_PREFIX = "Author Note:";

/** Default padding around graph nodes when auto-fitting a Hytale $Groups frame. */
export const AUTO_FRAME_PAD = 56;
/** Extra padding for labeled regions meant to be read by others. */
export const AUTO_FRAME_PAD_LABEL = 80;
/** Title bar height reserved above the wrapped node bounds (matches FrameNode header). */
export const AUTO_FRAME_HEADER = 28;
/** Default scale when spreading a selection for readability. */
export const LOOSEN_SCALE_DEFAULT = 1.35;
const MIN_FRAME_SIZE = 48;

export interface FrameAroundNodesOptions {
  pad?: number;
}

export interface LoosenNodesOptions {
  scale?: number;
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computeGraphBBox(
  graphNodes: Node[],
  sizeFor: (node: Node) => { width: number; height: number },
): BBox | null {
  if (graphNodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of graphNodes) {
    const { width, height } = sizeFor(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Spread selected nodes away from their collective center so wires and labels breathe.
 * Preserves relative layout — useful before framing a region for handoff.
 */
export function loosenNodesRelative(
  allNodes: Node[],
  nodeIds: Iterable<string>,
  options: LoosenNodesOptions = {},
): Node[] {
  const idSet = new Set(nodeIds);
  const selected = nodesEligibleForFraming(allNodes.filter((node) => idSet.has(node.id)));
  if (selected.length < 2) return allNodes;

  const scale = options.scale ?? LOOSEN_SCALE_DEFAULT;
  const box = computeGraphBBox(selected, () => ({ width: NODE_WIDTH, height: NODE_HEIGHT }));
  if (!box) return allNodes;

  const centerX = (box.minX + box.maxX) / 2;
  const centerY = (box.minY + box.maxY) / 2;

  return allNodes.map((node) => {
    if (!idSet.has(node.id) || !nodesEligibleForFraming([node]).length) return node;

    const nodeCenterX = node.position.x + NODE_WIDTH / 2;
    const nodeCenterY = node.position.y + NODE_HEIGHT / 2;

    return {
      ...node,
      position: {
        x: Math.round(centerX + (nodeCenterX - centerX) * scale - NODE_WIDTH / 2),
        y: Math.round(centerY + (nodeCenterY - centerY) * scale - NODE_HEIGHT / 2),
      },
    };
  });
}

/**
 * Build a Hytale-compatible frame node that wraps the given graph nodes.
 * Position/size match $Groups entries ($Position, $width, $height, $name).
 */
export function buildFrameAroundNodes(
  graphNodes: Node[],
  name: string,
  options: FrameAroundNodesOptions = {},
): Node | null {
  const pad = options.pad ?? AUTO_FRAME_PAD;
  const box = computeGraphBBox(graphNodes, () => ({ width: NODE_WIDTH, height: NODE_HEIGHT }));
  if (!box) return null;

  const width = Math.max(
    MIN_FRAME_SIZE,
    Math.round(box.maxX - box.minX + pad * 2),
  );
  const height = Math.max(
    MIN_FRAME_SIZE,
    Math.round(box.maxY - box.minY + pad * 2 + AUTO_FRAME_HEADER),
  );

  return {
    id: `frame-${crypto.randomUUID()}`,
    type: "frame",
    position: {
      x: box.minX - pad,
      y: box.minY - pad - AUTO_FRAME_HEADER,
    },
    data: {
      type: "frame",
      name,
      width,
      height,
    },
    draggable: true,
    selectable: true,
    selected: true,
    zIndex: -1,
  };
}

/** Graph nodes eligible for auto-framing (excludes annotations and collapsed groups). */
export function nodesEligibleForFraming(nodes: Node[]): Node[] {
  return nodes.filter(
    (node) => isGraphNode(node) && node.type !== "group",
  );
}

export function isAnnotationNode(node: { type?: string | null }): boolean {
  return node.type === "comment" || node.type === "frame";
}

export function isGraphNode(node: { type?: string | null }): boolean {
  return !isAnnotationNode(node);
}

export function annotationNodeSize(node: Node): { width: number; height: number } {
  const data = node.data as { width?: number; height?: number };
  if (node.type === "comment") {
    return { width: data.width ?? 240, height: data.height ?? 110 };
  }
  return { width: data.width ?? 300, height: data.height ?? 200 };
}

/** Frames behind graph nodes; comments above. */
export function layerCanvasNodes(graphNodes: Node[], annotationNodes: Node[]): Node[] {
  const frames = annotationNodes
    .filter((node) => node.type === "frame")
    .map((node) => ({ ...node, zIndex: -1 }));
  const comments = annotationNodes
    .filter((node) => node.type === "comment")
    .map((node) => ({ ...node, zIndex: 1 }));
  return [...frames, ...graphNodes, ...comments];
}

export function isAuthorNoteText(text: string | null | undefined): boolean {
  if (!text) return false;
  return text.trimStart().toLowerCase().startsWith(AUTHOR_NOTE_PREFIX.toLowerCase());
}

export function makeAuthorNoteText(text: string | null | undefined): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return `${AUTHOR_NOTE_PREFIX} `;
  if (isAuthorNoteText(trimmed)) return trimmed;
  return `${AUTHOR_NOTE_PREFIX} ${trimmed}`;
}

export function stripAuthorNotePrefix(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/^\s*author note:\s*/i, "");
}
