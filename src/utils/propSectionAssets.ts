import type { Edge, Node } from "@xyflow/react";

import { graphToJson, graphToJsonMulti } from "@/utils/graphToJson";
import { jsonToGraph } from "@/utils/jsonToGraph";

/**
 * Canonical Hytale prop entry shapes (reference corpus in templates/hytale-release):
 * 1. PropDistribution.Constant + Positions + Prop pipeline (Basic.json)
 * 2. PropDistribution.Union / Assigned + nested Positions + Assignments (Boreal1_Henges)
 * 3. Flat top-level Positions + Assignments (Plains1_Gorges, TheUnderworld)
 * 4. Flat positions with Assignment:Imported external defs (Plains1 Gorges grasses)
 * 5. TerraNova wizard stub — flat Positions + Assignments (minimalPrefabProp)
 */
export type PropSectionGraphMode = "propDistribution" | "flatSplit";

export interface PropSectionGraph {
  nodes: Node[];
  edges: Edge[];
  mode: PropSectionGraphMode;
}

function isTypedAsset(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && "Type" in (value as Record<string, unknown>));
}

function tagRootBiomeField(nodes: Node[], field: string): void {
  if (nodes.length === 0) return;
  const rootNode = nodes[nodes.length - 1];
  rootNode.data = {
    ...(rootNode.data as Record<string, unknown>),
    _biomeField: field,
  };
}

/** Resolve which JSON subtree(s) to graph for a biome Props[] entry. */
export function resolvePropGraphAssets(prop: Record<string, unknown>): {
  mode: PropSectionGraphMode;
  propDistribution?: Record<string, unknown>;
  positions?: Record<string, unknown>;
  assignments?: Record<string, unknown>;
} {
  const dist = prop.PropDistribution;
  if (isTypedAsset(dist)) {
    return { mode: "propDistribution", propDistribution: dist };
  }

  const positions = prop.Positions;
  const assignments = prop.Assignments;
  return {
    mode: "flatSplit",
    positions: isTypedAsset(positions) ? positions : undefined,
    assignments: isTypedAsset(assignments) ? assignments : undefined,
  };
}

/** Build React Flow nodes/edges for one Props[i] entry. */
export function buildPropSectionGraph(
  prop: Record<string, unknown>,
  idPrefix: string,
): PropSectionGraph {
  const resolved = resolvePropGraphAssets(prop);

  if (resolved.mode === "propDistribution" && resolved.propDistribution) {
    const { nodes, edges } = jsonToGraph(
      resolved.propDistribution,
      0,
      0,
      idPrefix,
      "PropDistribution",
    );
    tagRootBiomeField(nodes, "PropDistribution");
    return { nodes, edges, mode: "propDistribution" };
  }

  const allNodes: Node[] = [];
  const allEdges: Edge[] = [];

  if (resolved.positions) {
    const { nodes, edges } = jsonToGraph(resolved.positions, 0, 0, `${idPrefix}_pos`, "Positions");
    tagRootBiomeField(nodes, "Positions");
    allNodes.push(...nodes);
    allEdges.push(...edges);
  }

  if (resolved.assignments) {
    const { nodes, edges } = jsonToGraph(
      resolved.assignments,
      0,
      400,
      `${idPrefix}_asgn`,
      "Assignments",
    );
    tagRootBiomeField(nodes, "Assignments");
    allNodes.push(...nodes);
    allEdges.push(...edges);
  }

  return { nodes: allNodes, edges: allEdges, mode: "flatSplit" };
}

function getReachableNodeIds(
  startId: string,
  _nodes: Node[],
  edges: Edge[],
): Set<string> {
  const reachable = new Set<string>();
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const edge of edges) {
      if (edge.target === id && !reachable.has(edge.source)) stack.push(edge.source);
      if (edge.source === id && !reachable.has(edge.target)) stack.push(edge.target);
    }
  }
  return reachable;
}

function subgraphJson(
  rootId: string,
  sectionNodes: Node[],
  sectionEdges: Edge[],
): Record<string, unknown> | null {
  const ids = getReachableNodeIds(rootId, sectionNodes, sectionEdges);
  const nodes = sectionNodes.filter((n) => n && ids.has(n.id));
  const edges = sectionEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  return graphToJson(nodes, edges);
}

/** Rebuild one Props[] JSON entry from a prop section graph. */
export function buildPropEntryFromSection(
  sectionNodes: Node[],
  sectionEdges: Edge[],
  meta: { Runtime: number; Skip: boolean },
): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    Runtime: meta.Runtime,
    Skip: meta.Skip,
  };

  const distRoot = sectionNodes.find(
    (n) => (n?.data as Record<string, unknown> | undefined)?._biomeField === "PropDistribution",
  );
  if (distRoot) {
    const distJson = subgraphJson(distRoot.id, sectionNodes, sectionEdges);
    if (distJson) entry.PropDistribution = distJson;
    return entry;
  }

  const positionsRoot = sectionNodes.find(
    (n) => (n?.data as Record<string, unknown> | undefined)?._biomeField === "Positions",
  );
  const assignmentsRoot = sectionNodes.find(
    (n) => (n?.data as Record<string, unknown> | undefined)?._biomeField === "Assignments",
  );

  if (positionsRoot || assignmentsRoot) {
    if (positionsRoot) {
      const posJson = subgraphJson(positionsRoot.id, sectionNodes, sectionEdges);
      if (posJson) entry.Positions = posJson;
    }
    if (assignmentsRoot) {
      const asgnJson = subgraphJson(assignmentsRoot.id, sectionNodes, sectionEdges);
      if (asgnJson) entry.Assignments = asgnJson;
    }
    return entry;
  }

  const assets = graphToJsonMulti(sectionNodes, sectionEdges);
  if (assets[0]) entry.Positions = assets[0];
  if (assets[1]) entry.Assignments = assets[1];
  return entry;
}

/** Minimal PropDistribution graph for a single prefab path (wizard / quick-start). */
export function buildPropSectionFromPrefabPath(
  path: string,
  idPrefix = "starter",
): PropSectionGraph {
  const propDistribution = {
    Type: "PropDistribution:Constant",
    Positions: { Type: "Mesh2D", Resolution: 6, Jitter: 0.3 },
    Prop: {
      Type: "Prop:Prefab",
      Path: path,
      Directionality: { Type: "Uniform" },
      Scanner: {
        Type: "ColumnLinear",
        StepSize: 1,
        Range: { Min: 0, Max: 200 },
      },
    },
  };
  return buildPropSectionGraph(
    { Runtime: 0, Skip: false, PropDistribution: propDistribution },
    idPrefix,
  );
}
