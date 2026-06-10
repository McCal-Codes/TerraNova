import type { Node } from "@xyflow/react";
import { isAnnotationNode } from "@/utils/annotationUtils";

function getBareNodeType(node: Node): string {
  return (node.data as { type?: string } | undefined)?.type ?? "";
}

function getNodeDataFields(node: Node): Record<string, unknown> {
  return (node.data as { fields?: Record<string, unknown> } | undefined)?.fields ?? {};
}

/** Density numeric constant (`Value`), not tint (`Color`) or vector constant. */
export function isDensityConstantNode(node: Node): boolean {
  const fields = getNodeDataFields(node);
  if (typeof fields.Value !== "number") return false;
  if (typeof fields.Color === "string") return false;

  const bareType = getBareNodeType(node);
  const rfType = node.type && node.type !== "default" ? node.type : "";
  return bareType === "Constant" || rfType === "Tint:Constant";
}

/** Density height reader (`BaseHeightName` / `Distance`), not position-provider BaseHeight. */
export function isDensityBaseHeightNode(node: Node): boolean {
  const fields = getNodeDataFields(node);
  const hasDensityShape =
    typeof fields.BaseHeightName === "string"
    || typeof fields.Distance === "boolean";
  if (!hasDensityShape) return false;
  if (fields.Positions && typeof fields.Positions === "object") return false;

  const bareType = getBareNodeType(node);
  const rfType = node.type && node.type !== "default" ? node.type : "";
  return bareType === "BaseHeight" || rfType === "Position:BaseHeight";
}

export function isTintConstantColorNode(node: Node): boolean {
  const fields = getNodeDataFields(node);
  if (getBareNodeType(node) !== "Constant") return false;
  return typeof fields.Color === "string";
}

/** Diagnostics / handle lookup type — corrects mis-prefixed density nodes. */
export function resolveDensityDiagnosticsTypeKey(node: Node): string {
  const rfType = node.type && node.type !== "default" ? node.type : "";
  if (isDensityConstantNode(node)) return "Constant";
  if (isDensityBaseHeightNode(node)) return "BaseHeight";
  if (isTintConstantColorNode(node)) return "Tint:Constant";
  return rfType || getBareNodeType(node);
}

/**
 * Terrain tab nodes imported before the density prefix fix may use
 * `Tint:Constant` / `Position:BaseHeight` for density-shaped fields.
 */
export function normalizeDensitySectionNodeTypes(nodes: Node[]): Node[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (!node || isAnnotationNode(node) || node.type === "group") return node;

    if (isDensityConstantNode(node) && node.type !== "Constant") {
      changed = true;
      return { ...node, type: "Constant" };
    }
    if (isDensityBaseHeightNode(node) && node.type !== "BaseHeight") {
      changed = true;
      return { ...node, type: "BaseHeight" };
    }
    return node;
  });
  return changed ? next : nodes;
}
