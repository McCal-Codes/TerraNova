import type { Node, Edge } from "@xyflow/react";
import { DENSITY_TYPES, findDensityRoot, getNodeType } from "@/utils/density/evalTypes";

export type PreviewRootSource =
  | "explicit-selection"
  | "output-node"
  | "inferred-root"
  | "fallback"
  | "none";

export interface PreviewRootResolution {
  nodeId: string | null;
  source: PreviewRootSource;
  nodeType?: string;
  recommendedNodeId: string | null;
  connectedToOutput: boolean;
  warning?: string;
}

export interface PreviewRootInput {
  nodes: Node[];
  edges: Edge[];
  selectedPreviewNodeId?: string | null;
  outputNodeId?: string | null;
}

const INTERMEDIATE_WARNING =
  "This node is a density field, but it is not the graph's terrain output. Preview may appear fully solid or empty.";

const FALLBACK_WARNING =
  "Using the first density node in the graph — connect a Root node or designate an output for reliable previews.";

function findValidDensityNode(nodes: Node[], nodeId: string | null | undefined): Node | null {
  if (!nodeId) return null;
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  return DENSITY_TYPES.has(getNodeType(node)) ? node : null;
}

/** Authoritative terrain output before explicit preview-target overrides. */
export function getRecommendedTerrainRoot(
  nodes: Node[],
  edges: Edge[],
  outputNodeId?: string | null,
): Node | null {
  const rootNode = nodes.find((n) => n.type === "Root");
  if (rootNode) {
    const rootEdge = edges.find((e) => e.target === rootNode.id);
    if (rootEdge) {
      const wired = findValidDensityNode(nodes, rootEdge.source);
      if (wired) return wired;
    }
  }

  const output = findValidDensityNode(nodes, outputNodeId);
  if (output) return output;

  const inferred = findDensityRoot(nodes, edges);
  if (inferred && DENSITY_TYPES.has(getNodeType(inferred))) return inferred;

  return nodes.find((n) => DENSITY_TYPES.has(getNodeType(n))) ?? null;
}

/** Single resolver for preview evaluation, auto-fit, cache keys, and debug UI. */
export function resolvePreviewRoot(input: PreviewRootInput): PreviewRootResolution {
  const { nodes, edges, selectedPreviewNodeId, outputNodeId } = input;

  const recommended = getRecommendedTerrainRoot(nodes, edges, outputNodeId);
  const recommendedNodeId = recommended?.id ?? null;

  const explicit = findValidDensityNode(nodes, selectedPreviewNodeId);
  if (explicit) {
    const connectedToOutput = explicit.id === recommendedNodeId;
    return {
      nodeId: explicit.id,
      source: "explicit-selection",
      nodeType: getNodeType(explicit),
      recommendedNodeId,
      connectedToOutput,
      warning: connectedToOutput ? undefined : INTERMEDIATE_WARNING,
    };
  }

  const output = findValidDensityNode(nodes, outputNodeId);
  if (output) {
    return {
      nodeId: output.id,
      source: "output-node",
      nodeType: getNodeType(output),
      recommendedNodeId,
      connectedToOutput: true,
    };
  }

  const inferred = findDensityRoot(nodes, edges);
  if (inferred && DENSITY_TYPES.has(getNodeType(inferred))) {
    return {
      nodeId: inferred.id,
      source: "inferred-root",
      nodeType: getNodeType(inferred),
      recommendedNodeId: recommendedNodeId ?? inferred.id,
      connectedToOutput: true,
    };
  }

  const firstDensity = nodes.find((n) => DENSITY_TYPES.has(getNodeType(n)));
  if (firstDensity) {
    return {
      nodeId: firstDensity.id,
      source: "fallback",
      nodeType: getNodeType(firstDensity),
      recommendedNodeId,
      connectedToOutput: firstDensity.id === recommendedNodeId,
      warning: FALLBACK_WARNING,
    };
  }

  return {
    nodeId: null,
    source: "none",
    recommendedNodeId: null,
    connectedToOutput: false,
    warning: "No density node found for preview.",
  };
}

/** Preview evaluation root — honors explicit preview-target selection. */
export function resolvePreviewRootForEvaluation(input: PreviewRootInput): PreviewRootResolution {
  return resolvePreviewRoot(input);
}

export function resolvePreviewRootNodeId(input: PreviewRootInput): string | undefined {
  return resolvePreviewRootForEvaluation(input).nodeId ?? undefined;
}

/** Quick stats over a volume density buffer (Y-major layout). */
export function computeDensityVolumeStats(densities: Float32Array): {
  min: number;
  max: number;
  positiveFraction: number;
} {
  if (densities.length === 0) {
    return { min: 0, max: 0, positiveFraction: 0 };
  }

  let min = densities[0]!;
  let max = densities[0]!;
  let positive = 0;
  for (let i = 0; i < densities.length; i++) {
    const v = densities[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
    if (v >= 0) positive++;
  }
  return {
    min,
    max,
    positiveFraction: positive / densities.length,
  };
}
