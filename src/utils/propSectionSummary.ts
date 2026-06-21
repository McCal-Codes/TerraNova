import type { Edge, Node } from "@xyflow/react";

export interface PropSectionSummary {
  mode: "propDistribution" | "flatSplit";
  distributionVariant: string | null;
  positionsType: string | null;
  positionsParams: string;
  assignmentsType: string | null;
  assignmentsChain: string;
  shortLabel: string;
  prefabPath: string | null;
  importedName: string | null;
}

const POSITION_TYPES = new Set([
  "Scaler",
  "Jitter2d",
  "Occurrence",
  "BaseHeight",
  "TriangularGrid2d",
  "SquareGrid2d",
  "SimpleHorizontal",
  "Positions",
]);

const ASSIGNMENT_TYPES = new Set([
  "Imported",
  "Prefab",
  "Locator",
  "Cluster",
  "Weighted",
  "Cuboid",
  "PondFiller",
  "Assigned",
  "Assignments",
]);

function getNodeType(node: Node): string {
  return ((node.data as Record<string, unknown>).type as string) ?? "";
}

function getBiomeField(node: Node): string | null {
  const field = (node.data as Record<string, unknown>)._biomeField;
  return typeof field === "string" ? field : null;
}

function getNodeFields(node: Node): Record<string, unknown> {
  return ((node.data as Record<string, unknown>).fields as Record<string, unknown>) ?? {};
}

function extractFieldSummary(node: Node): string {
  const fields = getNodeFields(node);
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") {
      parts.push(`${k}=${v}`);
    }
  }
  return parts.join(", ");
}

function collectReachableIds(startId: string, nodes: Node[], edges: Edge[]): Set<string> {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    const fromSource = adjacency.get(edge.source) ?? [];
    fromSource.push(edge.target);
    adjacency.set(edge.source, fromSource);
    const fromTarget = adjacency.get(edge.target) ?? [];
    fromTarget.push(edge.source);
    adjacency.set(edge.target, fromTarget);
  }

  const reachable = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const next of adjacency.get(id) ?? []) {
      if (!reachable.has(next)) queue.push(next);
    }
  }
  return reachable;
}

function findFirstNodeByTypeBfs(
  startId: string,
  nodes: Node[],
  edges: Edge[],
  types: Set<string>,
): Node | null {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const reachable = collectReachableIds(startId, nodes, edges);
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!reachable.has(edge.source) || !reachable.has(edge.target)) continue;
    const fromSource = adjacency.get(edge.source) ?? [];
    fromSource.push(edge.target);
    adjacency.set(edge.source, fromSource);
    const fromTarget = adjacency.get(edge.target) ?? [];
    fromTarget.push(edge.source);
    adjacency.set(edge.target, fromTarget);
  }

  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = nodeById.get(id);
    if (node && types.has(getNodeType(node))) return node;
    for (const next of adjacency.get(id) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return null;
}

function walkAssignmentsChain(rootId: string, nodes: Node[], edges: Edge[]): string {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const upstream = new Map<string, string[]>();
  for (const edge of edges) {
    const list = upstream.get(edge.target) ?? [];
    list.push(edge.source);
    upstream.set(edge.target, list);
  }

  const visited = new Set<string>();
  const chain: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = nodeById.get(id);
    if (!node) continue;
    const type = getNodeType(node);
    if (type) chain.push(type);
    for (const parent of upstream.get(id) ?? []) {
      if (!visited.has(parent)) queue.push(parent);
    }
  }
  return chain.join(" \u2192 ");
}

function basenameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function buildShortLabel(input: {
  importedName: string | null;
  prefabPath: string | null;
  assignmentsType: string | null;
  positionsType: string | null;
}): string {
  if (input.importedName) return `Imported · ${input.importedName}`;
  if (input.prefabPath) return `Prefab · ${basenameFromPath(input.prefabPath)}`;
  if (input.assignmentsType && input.assignmentsType !== "—") return input.assignmentsType;
  if (input.positionsType && input.positionsType !== "—") return input.positionsType;
  return "Prop layer";
}

/** Summarize a Props[i] section graph for tabs, dashboard, and overview UI. */
export function summarizePropSectionFromGraph(nodes: Node[], edges: Edge[]): PropSectionSummary {
  const distRoot = nodes.find((n) => getBiomeField(n) === "PropDistribution") ?? null;
  const flatPosRoot = nodes.find((n) => getBiomeField(n) === "Positions") ?? null;
  const flatAsgnRoot = nodes.find((n) => getBiomeField(n) === "Assignments") ?? null;

  const mode: PropSectionSummary["mode"] = distRoot ? "propDistribution" : "flatSplit";
  const distributionVariant = distRoot ? getNodeType(distRoot) || null : null;

  let positionsNode = flatPosRoot;
  let assignmentsNode = flatAsgnRoot;

  if (distRoot) {
    positionsNode = findFirstNodeByTypeBfs(distRoot.id, nodes, edges, POSITION_TYPES);
    assignmentsNode = findFirstNodeByTypeBfs(distRoot.id, nodes, edges, ASSIGNMENT_TYPES);
  }

  const positionsType = positionsNode ? getNodeType(positionsNode) : null;
  const positionsParams = positionsNode ? extractFieldSummary(positionsNode) : "";
  const assignmentsType = assignmentsNode ? getNodeType(assignmentsNode) : null;
  const assignmentsChain = assignmentsNode
    ? walkAssignmentsChain(assignmentsNode.id, nodes, edges)
    : "";

  let importedName: string | null = null;
  let prefabPath: string | null = null;

  for (const node of nodes) {
    const type = getNodeType(node);
    const fields = getNodeFields(node);
    if (!importedName && type === "Imported" && typeof fields.Name === "string" && fields.Name.trim()) {
      importedName = fields.Name.trim();
    }
    if (!prefabPath && typeof fields.Path === "string" && fields.Path.trim()) {
      prefabPath = fields.Path.trim();
    }
    if (!prefabPath && Array.isArray(fields.WeightedPrefabPaths)) {
      const first = fields.WeightedPrefabPaths.find(
        (entry) => entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).Path === "string",
      ) as Record<string, unknown> | undefined;
      if (first?.Path && typeof first.Path === "string") {
        prefabPath = first.Path.trim();
      }
    }
  }

  const shortLabel = buildShortLabel({
    importedName,
    prefabPath,
    assignmentsType,
    positionsType,
  });

  return {
    mode,
    distributionVariant,
    positionsType,
    positionsParams,
    assignmentsType,
    assignmentsChain,
    shortLabel,
    prefabPath,
    importedName,
  };
}
