import type { Node, Edge } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";
import { isBaseHeightDistanceInput, resolveCurveMapperInputNode } from "@/utils/curveMapperDiagnostics";

const NOISE_SOURCE_TYPES = new Set([
  "SimplexNoise2D",
  "SimplexNoise3D",
  "SimplexRidgeNoise2D",
  "SimplexRidgeNoise3D",
  "CellNoise2D",
  "CellNoise3D",
  "FractalNoise2D",
  "FractalNoise3D",
]);

function isNoiseSourceType(type: string): boolean {
  return NOISE_SOURCE_TYPES.has(type);
}

/** Sources wired directly into Sum (Inputs[n] or legacy InputA/B). */
export function getSumDirectInputSources(
  sumNodeId: string,
  nodes: Node[],
  edges: Edge[],
): Node[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const sources: Node[] = [];
  for (const edge of edges) {
    if (edge.target !== sumNodeId) continue;
    const handle = edge.targetHandle ?? "";
    if (!handle.startsWith("Inputs[") && handle !== "InputA" && handle !== "InputB" && handle !== "Input") {
      continue;
    }
    const src = nodeById.get(edge.source);
    if (src) sources.push(src);
  }
  return sources;
}

/**
 * Anti-pattern: Sum(SimplexNoise2D, CurveMapper(BaseHeight)) — raw noise + height profile
 * creates sparse pillars / void. Release Example_Curve_Mapper nests noise in its own CurveMapper.
 */
export function sumHasRawNoisePlusHeightCurveMapper(
  sumNodeId: string,
  nodes: Node[],
  edges: Edge[],
): boolean {
  const sources = getSumDirectInputSources(sumNodeId, nodes, edges);
  const hasDirectNoise = sources.some((n) => isNoiseSourceType(getNodeType(n)));
  if (!hasDirectNoise) return false;

  const hasNestedNoiseCurveMapper = sources.some((n) => {
    if (getNodeType(n) !== "CurveMapper" && getNodeType(n) !== "CurveFunction") return false;
    const inputNode = resolveCurveMapperInputNode(n.id, nodes, edges);
    return inputNode != null && isNoiseSourceType(getNodeType(inputNode));
  });

  const hasHeightCurveMapper = sources.some((n) => {
    if (getNodeType(n) !== "CurveMapper" && getNodeType(n) !== "CurveFunction") return false;
    return isBaseHeightDistanceInput(resolveCurveMapperInputNode(n.id, nodes, edges));
  });

  return hasHeightCurveMapper && !hasNestedNoiseCurveMapper;
}
