import type { Node } from "@xyflow/react";
import { POSITION_TYPE_NAMES } from "@/utils/positionEvaluator";
import { extractPrefabPathFromFields } from "@/utils/hytaleBlockAssets/extractPrefabPath";

/** True when editing a standalone /props/ file or a biome Props[i] section. */
export function isPropEditingContext(
  editingContext: string | null,
  activeBiomeSection: string | null | undefined,
): boolean {
  if (editingContext === "Prop") return true;
  if (activeBiomeSection?.startsWith("Props[")) return true;
  return false;
}

/** Node tagged as the Positions root in a biome prop section graph. */
export function findPositionsRootNodeId(nodes: Node[]): string | null {
  const tagged = nodes.find(
    (n) => (n.data as Record<string, unknown>)._biomeField === "Positions",
  );
  return tagged?.id ?? null;
}

export function isPositionProviderNode(node: Node): boolean {
  const rfType = node.type ?? "";
  if (rfType.startsWith("Position:")) return true;
  if (rfType.startsWith("Material:") || rfType.startsWith("Prop:") || rfType.startsWith("Density:")) {
    return false;
  }
  const data = node.data as Record<string, unknown>;
  if (data._biomeField === "Positions") return true;
  const rawType = ((data.type as string) ?? "").replace(/^Position:/, "");
  return (POSITION_TYPE_NAMES as readonly string[]).includes(rawType);
}

/** True when the graph includes at least one Positions provider node. */
export function hasPropPlacementProviders(nodes: Node[]): boolean {
  return nodes.some((n) => isPositionProviderNode(n));
}

/**
 * Preview root for prop placement: prefer an explicitly selected Position node,
 * otherwise the tagged Positions root, otherwise auto-detect in the evaluator.
 */
export function resolvePropPlacementRootNodeId(
  nodes: Node[],
  selectedNodeId: string | null,
): string | undefined {
  if (selectedNodeId) {
    const selected = nodes.find((n) => n.id === selectedNodeId);
    if (selected && isPositionProviderNode(selected)) {
      return selectedNodeId;
    }
  }
  return findPositionsRootNodeId(nodes) ?? undefined;
}

export interface PropPrefabPreviewSource {
  nodeId: string;
  fields: Record<string, unknown>;
  path: string;
}

/** Selected Prop:Prefab node, or the first prefab node in the graph with a Path set. */
export function resolvePropPrefabPreviewSource(
  nodes: Node[],
  selectedNodeId: string | null,
): PropPrefabPreviewSource | null {
  const tryNode = (node: Node): PropPrefabPreviewSource | null => {
    const isPrefab =
      node.type === "Prop:Prefab"
      || (node.data as { type?: string } | undefined)?.type === "Prefab";
    if (!isPrefab) return null;
    const fields = ((node.data as { fields?: Record<string, unknown> })?.fields) ?? {};
    const path = extractPrefabPathFromFields(fields);
    if (!path) return null;
    return { nodeId: node.id, fields, path };
  };

  if (selectedNodeId) {
    const selected = nodes.find((n) => n.id === selectedNodeId);
    if (selected) {
      const match = tryNode(selected);
      if (match) return match;
    }
  }

  for (const node of nodes) {
    const match = tryNode(node);
    if (match) return match;
  }

  return null;
}

/** Manual browse path wins when set; otherwise fall back to the graph prefab node. */
export function resolveEffectivePrefabPreviewSource(
  graphSource: PropPrefabPreviewSource | null,
  manualPath: string | null,
): PropPrefabPreviewSource | null {
  const trimmed = manualPath?.trim();
  if (trimmed) {
    return {
      nodeId: graphSource?.nodeId ?? "",
      fields: { Path: trimmed },
      path: trimmed,
    };
  }
  return graphSource;
}
