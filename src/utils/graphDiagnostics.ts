import type { Node, Edge } from "@xyflow/react";
import type { BaseNodeData } from "@/nodes/shared/BaseNode";
import type { HandleDef } from "@/nodes/shared/handles";
import { getHandles, findHandleDef } from "@/nodes/handleRegistry";
import { COMPOUND_PORTS } from "@/nodes/shared/compoundPorts";
import { resolveCompoundHandles } from "@/nodes/shared/resolveCompoundHandles";
import { getConstraints, OUTPUT_RANGES } from "@/schema/constraints";
import type { FieldConstraint } from "@/schema/validation";
import { validateFields } from "@/schema/validation";
import { isDeprecatedOrLegacyTypeKey, getLegacyReplacement, getDeprecationTier, isPrereleaseTypeKey } from "@/nodes/shared/legacyTypes";
import { nodeTypes } from "@/nodes/index";
import { getEvalStatus } from "@/utils/densityEvaluator";
import { findDensityRoot } from "./density/evalTypes";
import { EvalStatus } from "@/schema/types";
import {
  cloneDelimiterRecords,
  readDelimiterEnvironmentReference,
  validateEnvironmentDelimiters,
} from "@/utils/environmentDelimiters";
import type { AssetReferenceKind } from "@/utils/environmentAssetLookup";
import { usesServerDefaultEnvironment } from "@/utils/atmosphere";
import connectionsData from "@/data/connections.json";
import {
  isDensityBaseHeightNode,
  isDensityConstantNode,
  isTintConstantColorNode,
  resolveDensityDiagnosticsTypeKey,
} from "@/utils/densitySectionNodes";
import {
  CURVE_INPUT_HANDLE_IDS,
  hasInlineCurveField,
  isCurveFieldConstraintSatisfied,
} from "@/utils/propertyPanelFields";
import {
  getCurveMapperManualInRange,
  isBaseHeightDistanceInput,
  isLikelyNormalizedCurveOnBlockOffsetInput,
  resolveCurveMapperInputNode,
} from "@/utils/curveMapperDiagnostics";
import { sumHasRawNoisePlusHeightCurveMapper } from "@/utils/sumTerrainPattern";
import { isAnnotationNode } from "@/utils/annotationUtils";

// ── Hytale known environment names (from Server/Environments/) ──────────────

export const HYTALE_KNOWN_ENVIRONMENTS = new Set([
  // Zone 0
  "Env_Zone0",
  // Zone 1
  "Env_Zone1", "Env_Zone1_Autumn", "Env_Zone1_Azure", "Env_Zone1_Caves",
  "Env_Zone1_Caves_Forests", "Env_Zone1_Caves_Goblins", "Env_Zone1_Caves_Mountains",
  "Env_Zone1_Caves_Plains", "Env_Zone1_Caves_Rats", "Env_Zone1_Caves_Spiders",
  "Env_Zone1_Caves_Swamps", "Env_Zone1_Caves_Volcanic_T1", "Env_Zone1_Caves_Volcanic_T2",
  "Env_Zone1_Caves_Volcanic_T3", "Env_Zone1_Dungeons", "Env_Zone1_Encounters",
  "Env_Zone1_Forests", "Env_Zone1_Graveyard", "Env_Zone1_Kweebec",
  "Env_Zone1_Mage_Towers", "Env_Zone1_Mineshafts", "Env_Zone1_Mountains",
  "Env_Zone1_Plains", "Env_Zone1_Shores", "Env_Zone1_Swamps", "Env_Zone1_Trork",
  // Zone 2
  "Env_Zone2", "Env_Zone2_Caves", "Env_Zone2_Caves_Deserts", "Env_Zone2_Caves_Goblins",
  "Env_Zone2_Caves_Plateaus", "Env_Zone2_Caves_Rats", "Env_Zone2_Caves_Savanna",
  "Env_Zone2_Caves_Scarak", "Env_Zone2_Caves_Scrub", "Env_Zone2_Caves_Volcanic_T1",
  "Env_Zone2_Caves_Volcanic_T2", "Env_Zone2_Caves_Volcanic_T3", "Env_Zone2_Deserts",
  "Env_Zone2_Dungeons", "Env_Zone2_Encounters", "Env_Zone2_Feran",
  "Env_Zone2_Mage_Towers", "Env_Zone2_Mineshafts", "Env_Zone2_Oasis",
  "Env_Zone2_Plateaus", "Env_Zone2_Savanna", "Env_Zone2_Scarak",
  "Env_Zone2_Scrub", "Env_Zone2_Shores",
  // Zone 3
  "Env_Zone3", "Env_Zone3_Caves", "Env_Zone3_Caves_Forests", "Env_Zone3_Caves_Glacial",
  "Env_Zone3_Caves_Mountains", "Env_Zone3_Caves_Spider", "Env_Zone3_Caves_Tundra",
  "Env_Zone3_Caves_Volcanic_T1", "Env_Zone3_Caves_Volcanic_T2", "Env_Zone3_Caves_Volcanic_T3",
  "Env_Zone3_Dungeons", "Env_Zone3_Encounters", "Env_Zone3_Forests",
  "Env_Zone3_Glacial", "Env_Zone3_Glacial_Henges", "Env_Zone3_Hedera",
  "Env_Zone3_Mage_Towers", "Env_Zone3_Mineshafts", "Env_Zone3_Mountains",
  "Env_Zone3_Outlander", "Env_Zone3_Shores", "Env_Zone3_Tundra",
  // Zone 4
  "Env_Zone4", "Env_Zone4_Caves", "Env_Zone4_Caves_Volcanic", "Env_Zone4_Crucible",
  "Env_Zone4_Dungeons", "Env_Zone4_Encounters", "Env_Zone4_Forests",
  "Env_Zone4_Jungles", "Env_Zone4_Mage_Towers", "Env_Zone4_Sewers",
  "Env_Zone4_Shores", "Env_Zone4_Volcanoes", "Env_Zone4_Wastes",
  // Unique / Special
  "Env_Creative_Hub", "Env_Default_Flat", "Env_Default_Void",
  "Env_Forgotten_Temple_Base", "Env_Forgotten_Temple_Exterior",
  "Env_Forgotten_Temple_Heart", "Env_Forgotten_Temple_Interior_Grand",
  "Env_Forgotten_Temple_Interior_Small", "Env_Forgotten_Temple_Interior_Tent",
  "Env_Portals_Hedera", "Env_Portals_Oasis",
  "Env_Temple_of_Gaia", "Env_Void",
  // Legacy / alias-style names observed in shipped biome assets
  "Zone1_Overground", "Zone1_Underground", "Zone1_Plains", "Zone3_Overground",
  // Hytale sentinel used for Default environment provider export
  "default",
]);

const connectionMatrix = connectionsData.connectionMatrix as Record<string, Record<string, number>>;

export type DiagnosticSeverity = "error" | "warning" | "info";
export type GraphDiagnosticCode =
  | "field-constraint"
  | "import-missing-name"
  | "asset-import-unknown-ref"
  | "env-delimiter-invalid-range"
  | "env-delimiter-missing-range"
  | "env-delimiter-overlap"
  | "env-delimiter-gap"
  | "env-delimiter-missing-environment"
  | "env-delimiter-unknown-environment"
  | "env-delimiter-unsupported-provider"
  | "biome-environment-missing-provider"
  | "biome-environment-unknown-ref"
  | "biome-environment-no-constants"
  | "biome-environment-missing-ref-name"
  | "biome-tint-missing-provider"
  | "biome-tint-missing-ref-name"
  | "biome-tint-unknown-ref"
  | "biome-name-missing"
  | "legacy-node"
  | "unknown-node-type"
  | "prop-conditional-lossy-export"
  | "material-block-unknown"
  | "assignment-import-unknown-ref"
  | "duplicate-export-as"
  | "prop-prefab-incomplete"
  | "column-scanner-range"
  | "curvemapper-in-range-mismatch"
  | "curvemapper-out-range-hint"
  | "sum-raw-noise-height-curvemapper"
  | "prerelease-node";

export interface GraphDiagnostic {
  nodeId: string | null;
  message: string;
  severity: DiagnosticSeverity;
  biomeSection?: string | null;
  code?: GraphDiagnosticCode;
  field?: string | null;
  meta?: Record<string, unknown>;
}

function collectUpstreamIds(
  nodeId: string,
  reverseAdj: Map<string, string[]>,
  out: Set<string>,
): void {
  if (out.has(nodeId)) return;
  out.add(nodeId);
  for (const src of reverseAdj.get(nodeId) ?? []) {
    collectUpstreamIds(src, reverseAdj, out);
  }
}

function getNodeType(node: Node): string {
  return (node.data as BaseNodeData).type ?? "";
}

function getNodeFields(node: Node): Record<string, unknown> {
  return (node.data as BaseNodeData).fields ?? {};
}

/** Canvas annotations and collapsed groups are not part of the density graph. */
function participatesInFlowAnalysis(node: Node): boolean {
  return !isAnnotationNode(node) && node.type !== "group";
}

function resolveDiagnosticsTypeKey(node: Node): string {
  return resolveDensityDiagnosticsTypeKey(node);
}

function resolveCompoundPortKey(node: Node): string | null {
  const typeKey = resolveDiagnosticsTypeKey(node);
  if (COMPOUND_PORTS[typeKey]) return typeKey;
  const bareType = getNodeType(node);
  if (bareType && COMPOUND_PORTS[bareType]) return bareType;
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCompoundConnectedIndices(
  nodeId: string,
  arrayBase: string,
  edges: Edge[],
): number[] {
  const pattern = new RegExp(`^${escapeRegExp(arrayBase)}\\[(\\d+)\\]$`);
  const indices: number[] = [];
  for (const edge of edges) {
    if (edge.target !== nodeId) continue;
    const match = pattern.exec(edge.targetHandle ?? "");
    if (match) indices.push(parseInt(match[1], 10));
  }
  return indices;
}

function hasCompoundInputsConnected(
  nodeId: string,
  arrayBase: string,
  incomingByTarget: Map<string, Set<string>>,
): boolean {
  const connected = incomingByTarget.get(nodeId);
  if (!connected) return false;
  const pattern = new RegExp(`^${escapeRegExp(arrayBase)}\\[\\d+\\]$`);
  for (const handleId of connected) {
    if (pattern.test(handleId)) return true;
  }
  return false;
}

function shouldWarnDisconnectedCompoundHandle(
  handleId: string,
  arrayBase: string,
  minSlots: number,
  connectedIndices: number[],
): boolean {
  const pattern = new RegExp(`^${escapeRegExp(arrayBase)}\\[(\\d+)\\]$`);
  const match = pattern.exec(handleId);
  if (!match) return true;

  const index = parseInt(match[1], 10);
  if (connectedIndices.includes(index)) return false;

  const maxConnected = connectedIndices.length > 0 ? Math.max(...connectedIndices) : -1;
  const slotCount = Math.max(minSlots, maxConnected + 2);

  if (connectedIndices.length === 0) {
    return index < minSlots;
  }

  if (index < maxConnected) return true;
  if (index >= maxConnected + 1 && index < slotCount) return false;
  return index < minSlots;
}

function getInputHandlesForNode(node: Node, edges: Edge[]): HandleDef[] {
  const compoundKey = resolveCompoundPortKey(node);
  const typeKey = resolveDiagnosticsTypeKey(node);
  const handles = compoundKey
    ? resolveCompoundHandles(node.id, compoundKey, edges)
    : getHandles(typeKey);
  return handles.filter((handle) => handle.type === "target");
}

/** Avoid bundle mismatches (e.g. density Sum vs curve Sum `Curves` field). */
function getGraphDiagnosticsConstraints(node: Node): Record<string, FieldConstraint> | undefined {
  const typeKey = resolveDiagnosticsTypeKey(node);
  const constraints = getConstraints(typeKey);
  if (!constraints) return undefined;

  const compoundKey = resolveCompoundPortKey(node);
  const filtered = { ...constraints };

  if (isDensityBaseHeightNode(node)) {
    delete filtered.Positions;
  }
  if (isDensityConstantNode(node)) {
    delete filtered.Tint;
    delete filtered.Color;
  } else if (isTintConstantColorNode(node)) {
    delete filtered.Tint;
  }

  if (!compoundKey) {
    return Object.keys(filtered).length > 0 ? filtered : undefined;
  }

  const compound = COMPOUND_PORTS[compoundKey];
  delete filtered.Curves;
  delete filtered[compound.arrayBase];
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

type KnownAssetNameMap = Partial<Record<AssetReferenceKind, string[]>>;

function normalizeKnownName(name: string): string {
  return name.trim().toLowerCase();
}

function buildKnownAssetNameSets(knownAssetNames?: KnownAssetNameMap | null): Record<AssetReferenceKind, Set<string>> {
  const environmentNames = new Set<string>();
  for (const name of HYTALE_KNOWN_ENVIRONMENTS) {
    environmentNames.add(normalizeKnownName(name));
  }

  const sets: Record<AssetReferenceKind, Set<string>> = {
    environment: environmentNames,
    tint: new Set<string>(),
    material: new Set<string>(),
    prop: new Set<string>(),
    assignment: new Set<string>(),
  };

  if (!knownAssetNames) return sets;

  for (const kind of Object.keys(sets) as AssetReferenceKind[]) {
    const names = knownAssetNames[kind];
    if (!names) continue;
    for (const name of names) {
      if (typeof name === "string" && name.trim()) {
        sets[kind].add(normalizeKnownName(name));
      }
    }
  }

  return sets;
}

function getImportedAssetKind(node: Node): AssetReferenceKind | null {
  const rfType = node.type ?? "";
  if (rfType === "Environment:Imported") return "environment";
  if (rfType === "Tint:Imported") return "tint";
  if (rfType === "Material:Imported") return "material";
  if (rfType === "Prop:Imported") return "prop";
  if (rfType === "Assignment:Imported") return "assignment";
  return null;
}

function getAssetKindLabel(kind: AssetReferenceKind): string {
  switch (kind) {
    case "environment":
      return "Environment";
    case "tint":
      return "Tint";
    case "material":
      return "Material";
    case "prop":
      return "Prop";
    case "assignment":
      return "Assignment";
  }
}

interface InlineImportedRef {
  fieldPath: string;
  name: string;
}

/** Collect inline `Type: Imported` Name references from nested field trees. */
export function collectInlineImportedRefs(
  value: unknown,
  fieldPath = "root",
  out: InlineImportedRef[] = [],
): InlineImportedRef[] {
  if (!value || typeof value !== "object") return out;
  const row = value as Record<string, unknown>;
  if (row.Type === "Imported") {
    const name = typeof row.Name === "string" ? row.Name.trim() : "";
    if (name) {
      out.push({ fieldPath, name });
    }
  }
  for (const [key, child] of Object.entries(row)) {
    if (key.startsWith("$") || key === "_comment") continue;
    if (Array.isArray(child)) {
      child.forEach((item, index) => {
        collectInlineImportedRefs(item, `${fieldPath}.${key}[${index}]`, out);
      });
    } else if (child && typeof child === "object") {
      collectInlineImportedRefs(child, `${fieldPath}.${key}`, out);
    }
  }
  return out;
}

function isEnvironmentDensityDelimitedNode(node: Node): boolean {
  const rfType = node.type ?? "";
  const data = node.data as BaseNodeData;
  return rfType === "Environment:DensityDelimited"
    || (data.type === "DensityDelimited" && data._biomeField === "EnvironmentProvider");
}

/** Extract Min/Max from a nested range object like { Min: -1, Max: 1 } */
function getRangeValues(obj: unknown): [number, number] | undefined {
  if (obj && typeof obj === "object" && "Min" in (obj as Record<string, unknown>) && "Max" in (obj as Record<string, unknown>)) {
    const r = obj as { Min: number; Max: number };
    if (typeof r.Min === "number" && typeof r.Max === "number") {
      return [r.Min, r.Max];
    }
  }
  return undefined;
}

export function analyzeGraph(
  nodes: Node[],
  edges: Edge[],
  knownAssetNames?: KnownAssetNameMap | null,
  channel?: string | null,
): GraphDiagnostic[] {
  if (nodes.length === 0) return [];

  const diagnostics: GraphDiagnostic[] = [];
  const knownAssetSets = buildKnownAssetNameSets(knownAssetNames);

  // Build lookup maps
  const incomingByTarget = new Map<string, Set<string>>();
  const outgoingBySource = new Map<string, Set<string>>();
  const adjacency = new Map<string, Set<string>>(); // target → set of sources

  for (const edge of edges) {
    // Target handle tracking
    if (!incomingByTarget.has(edge.target)) incomingByTarget.set(edge.target, new Set());
    incomingByTarget.get(edge.target)!.add(edge.targetHandle ?? "Input");

    // Outgoing tracking
    if (!outgoingBySource.has(edge.source)) outgoingBySource.set(edge.source, new Set());
    outgoingBySource.get(edge.source)!.add(edge.target);

    // Adjacency (directed: source → target)
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    adjacency.get(edge.source)!.add(edge.target);
  }

  // 1. Disconnected required inputs
  for (const node of nodes) {
    if (!participatesInFlowAnalysis(node)) continue;
    const type = getNodeType(node);
    const compoundKey = resolveCompoundPortKey(node);
    const compound = compoundKey ? COMPOUND_PORTS[compoundKey] : null;
    const inputHandles = getInputHandlesForNode(node, edges);
    if (!inputHandles.length) continue;

    const fields = getNodeFields(node);
    const connectedHandles = incomingByTarget.get(node.id) ?? new Set();
    const connectedCompoundIndices = compound
      ? getCompoundConnectedIndices(node.id, compound.arrayBase, edges)
      : [];
    const showIdx = inputHandles.length >= 2;
    for (let idx = 0; idx < inputHandles.length; idx++) {
      const handle = inputHandles[idx];
      if (connectedHandles.has(handle.id)) continue;
      if (
        CURVE_INPUT_HANDLE_IDS.has(handle.id)
        && hasInlineCurveField(fields, "Curve")
      ) {
        continue;
      }
      if (
        compound
        && !shouldWarnDisconnectedCompoundHandle(
          handle.id,
          compound.arrayBase,
          compound.minSlots,
          connectedCompoundIndices,
        )
      ) {
        continue;
      }
      const label = showIdx ? `[${idx}] ${handle.label}` : handle.label;
      diagnostics.push({
        nodeId: node.id,
        message: `${type}: input "${label}" is disconnected`,
        severity: "warning",
      });
    }
  }

  // 2. Unsupported / approximated preview types on evaluation path
  const previewReverseAdj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!previewReverseAdj.has(edge.target)) previewReverseAdj.set(edge.target, []);
    previewReverseAdj.get(edge.target)!.push(edge.source);
  }
  const previewRoot = findDensityRoot(nodes, edges);
  const onPreviewPath = new Set<string>();
  if (previewRoot) {
    collectUpstreamIds(previewRoot.id, previewReverseAdj, onPreviewPath);
  }

  for (const node of nodes) {
    const type = getNodeType(node);
    const status = getEvalStatus(type);
    if (status === EvalStatus.Unsupported) {
      diagnostics.push({
        nodeId: node.id,
        message: `${type}: not supported in preview (returns 0)`,
        severity: onPreviewPath.has(node.id) ? "warning" : "info",
      });
    } else if (status === EvalStatus.Approximated && onPreviewPath.has(node.id)) {
      diagnostics.push({
        nodeId: node.id,
        message: `${type}: approximated preview semantics on evaluation path`,
        severity: "info",
      });
    }
  }

  // 2a. Prop Conditional export is lossy (Hytale has no prop Conditional)
  for (const node of nodes) {
    const typeKey = node.type ?? getNodeType(node);
    if (typeKey === "Prop:Conditional" || (getNodeType(node) === "Conditional" && typeKey.startsWith("Prop:"))) {
      diagnostics.push({
        nodeId: node.id,
        message:
          "Prop Conditional exports only TrueInput to Hytale — FalseInput and the condition are dropped at export",
        severity: "warning",
        code: "prop-conditional-lossy-export",
      });
    }
  }

  // 2b. Legacy / deprecated node warnings
  for (const node of nodes) {
    const type = getNodeType(node);
    const nodeTypeKey = node.type ?? type;
    if (isDeprecatedOrLegacyTypeKey(nodeTypeKey)) {
      const tier = getDeprecationTier(nodeTypeKey);
      const replacement = getLegacyReplacement(nodeTypeKey);
      const preferMsg = replacement ? ` — prefer ${replacement}` : "";
      diagnostics.push({
        nodeId: node.id,
        message: `${type}: ${tier} legacy node for older generator JSON — Update 5 graphs use prefixed editor types where applicable${preferMsg}`,
        severity: "warning",
        code: "legacy-node",
        meta: { legacyTypeKey: nodeTypeKey, deprecationTier: tier, replacement },
      });
    } else if (isPrereleaseTypeKey(nodeTypeKey) && channel !== "pre-release") {
      diagnostics.push({
        nodeId: node.id,
        message: `${type}: pre-release node — only available in Hytale pre-release builds. Switch to the pre-release channel in Settings, or remove this node.`,
        severity: "warning",
        code: "prerelease-node",
        meta: { nodeTypeKey },
      });
    } else if (
      nodeTypeKey
      && nodeTypeKey !== "default"
      && nodeTypeKey !== "comment"
      && nodeTypeKey !== "frame"
      && !(nodeTypeKey in nodeTypes)
    ) {
      diagnostics.push({
        nodeId: node.id,
        message: `${type}: "${nodeTypeKey}" is not in the TerraNova palette — may still round-trip if valid in Hytale JSON`,
        severity: "warning",
        code: "unknown-node-type",
        meta: { nodeTypeKey },
      });
    }
  }

  // 3. Cycle detection — Kahn's algorithm
  //    Use an array (not Set) for adjacency so parallel edges between the same
  //    node pair (e.g. Noise → Sum.InputA AND Noise → Sum.InputB) are preserved.
  //    Each edge must decrement in-degree exactly once.
  const kahnAdj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    kahnAdj.set(node.id, []);
  }
  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    kahnAdj.get(edge.source)?.push(edge.target);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let sorted = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted++;
    const neighbors = kahnAdj.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }
  }

  if (sorted < nodes.filter(participatesInFlowAnalysis).length) {
    // Some nodes are in a cycle
    const cycleNodes = nodes.filter(
      (n) => participatesInFlowAnalysis(n) && (inDegree.get(n.id) ?? 0) > 0,
    );
    for (const node of cycleNodes) {
      diagnostics.push({
        nodeId: node.id,
        message: `${getNodeType(node)}: part of a cycle`,
        severity: "error",
      });
    }
  }

  // 4. Dead nodes — BFS backward from terminal nodes
  // Terminals are nodes with no outgoing edges that have at least one incoming edge (true sinks)
  const nodesWithIncoming = new Set(edges.map((e) => e.target));
  const terminals = nodes.filter(
    (n) =>
      participatesInFlowAnalysis(n)
      && !outgoingBySource.has(n.id)
      && nodesWithIncoming.has(n.id),
  );

  // Build reverse adjacency: target → sources
  const reverseAdj = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!reverseAdj.has(edge.target)) reverseAdj.set(edge.target, new Set());
    reverseAdj.get(edge.target)!.add(edge.source);
  }

  const reachable = new Set<string>();
  const bfsQueue = terminals.map((n) => n.id);
  while (bfsQueue.length > 0) {
    const current = bfsQueue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    const parents = reverseAdj.get(current);
    if (parents) {
      for (const parent of parents) {
        if (!reachable.has(parent)) bfsQueue.push(parent);
      }
    }
  }

  // Only report dead nodes if there are actual terminal sinks
  if (terminals.length > 0) {
    for (const node of nodes) {
      if (!participatesInFlowAnalysis(node)) continue;
      if (!reachable.has(node.id)) {
        diagnostics.push({
          nodeId: node.id,
          message: `${getNodeType(node)}: unreachable (dead node)`,
          severity: "warning",
        });
      }
    }
  }

  // 5. Clamp WallB > WallA warning (V2 naming: WallA=upper, WallB=lower)
  for (const node of nodes) {
    const type = getNodeType(node);
    if (type === "Clamp" || type === "SmoothClamp") {
      const fields = getNodeFields(node);
      const lower = typeof fields.WallB === "number" ? fields.WallB : typeof fields.Min === "number" ? fields.Min : undefined;
      const upper = typeof fields.WallA === "number" ? fields.WallA : typeof fields.Max === "number" ? fields.Max : undefined;
      if (lower !== undefined && upper !== undefined && lower > upper) {
        diagnostics.push({
          nodeId: node.id,
          message: `${type}: WallB (${lower}) exceeds WallA (${upper}) — empty range`,
          severity: "warning",
        });
      }
    }
  }

  // 6. Normalizer inverted range
  for (const node of nodes) {
    const type = getNodeType(node);
    if (type === "Normalizer") {
      const fields = getNodeFields(node);
      const sourceRange = getRangeValues(fields.SourceRange);
      if (sourceRange && sourceRange[0] >= sourceRange[1]) {
        diagnostics.push({
          nodeId: node.id,
          message: `Normalizer: SourceRange Min (${sourceRange[0]}) >= Max (${sourceRange[1]}) — inverted input range`,
          severity: "warning",
        });
      }
    }
  }

  // 7. Empty Sum/Product inputs
  const MULTI_INPUT_TYPES = new Set(["Sum", "Product"]);
  for (const node of nodes) {
    const type = getNodeType(node);
    if (MULTI_INPUT_TYPES.has(type)) {
      const connectedHandles = incomingByTarget.get(node.id);
      if (!connectedHandles || connectedHandles.size === 0) {
        diagnostics.push({
          nodeId: node.id,
          message: `${type}: no inputs connected`,
          severity: "warning",
        });
      }
    }
  }

  // 8. Field constraint violations (bridge per-field validation into graph diagnostics)
  for (const node of nodes) {
    const typeKey = resolveDiagnosticsTypeKey(node);
    const constraints = getGraphDiagnosticsConstraints(node);
    if (!constraints) continue;

    const compoundKey = resolveCompoundPortKey(node);
    const compound = compoundKey ? COMPOUND_PORTS[compoundKey] : null;
    const fields = getNodeFields(node);
    const issues = validateFields(fields, constraints);
    for (const issue of issues) {
      const constraint = constraints[issue.field];
      if (
        compound
        && (issue.field === "Curves" || issue.field === compound.arrayBase)
        && hasCompoundInputsConnected(node.id, compound.arrayBase, incomingByTarget)
      ) {
        continue;
      }
      if (
        issue.severity === "error"
        && constraint?.required
        && isCurveFieldConstraintSatisfied(
          issue.field,
          fields,
          node.id,
          incomingByTarget,
        )
      ) {
        continue;
      }
      const isMissingImportName =
        getImportedAssetKind(node) !== null && issue.field === "Name";
      diagnostics.push({
        nodeId: node.id,
        message: `${typeKey}.${issue.field}: ${issue.message}`,
        severity: issue.severity,
        code: isMissingImportName ? "import-missing-name" : "field-constraint",
        field: issue.field,
        meta: {
          currentValue: fields[issue.field],
          constraintMin: constraint?.min,
          constraintMax: constraint?.max,
          constraintRequired: constraint?.required,
        },
      });
    }
  }

  // 8b. Material Constant block ID validation (release uses block ids, not Materials/*.json)
  for (const node of nodes) {
    const typeKey = node.type ?? "";
    const isMaterialConstant =
      typeKey === "Material:Constant"
      || (getNodeType(node) === "Constant" && typeKey.startsWith("Material:"));
    if (!isMaterialConstant) continue;

    const fields = getNodeFields(node);
    let blockId = "";
    const rawMaterial = fields.Material;
    if (typeof rawMaterial === "string") {
      blockId = rawMaterial.trim();
    } else if (rawMaterial && typeof rawMaterial === "object") {
      const solid = (rawMaterial as Record<string, unknown>).Solid;
      if (typeof solid === "string") blockId = solid.trim();
    }
    if (!blockId || blockId === "Empty" || blockId === "Air") continue;

    const knownMaterials = knownAssetSets.material;
    if (knownMaterials.size === 0) continue;
    if (!knownMaterials.has(normalizeKnownName(blockId))) {
      diagnostics.push({
        nodeId: node.id,
        message: `Material Constant references unknown block "${blockId}" (not in project assets or synced block icons)`,
        severity: "warning",
        code: "material-block-unknown",
        field: "Material",
        meta: { assetKind: "material", importName: blockId },
      });
    }
  }

  // 8c. Imported asset reference validation
  for (const node of nodes) {
    const assetKind = getImportedAssetKind(node);
    if (!assetKind) continue;

    const fields = getNodeFields(node);
    const importName = typeof fields.Name === "string" ? fields.Name.trim() : "";
    const knownNames = knownAssetSets[assetKind];

    if (!importName) {
      diagnostics.push({
        nodeId: node.id,
        message: `${getAssetKindLabel(assetKind)} Imported is missing a Name reference`,
        severity: "warning",
        code: "import-missing-name",
        field: "Name",
        meta: { assetKind },
      });
      continue;
    }
    if (knownNames.size === 0) continue;
    if (knownNames.has(normalizeKnownName(importName))) continue;

    diagnostics.push({
      nodeId: node.id,
      message: `${getAssetKindLabel(assetKind)} Imported references unknown asset "${importName}"`,
      severity: "warning",
      code: "asset-import-unknown-ref",
      field: "Name",
      meta: { assetKind, importName },
    });
  }

  // 8c2. Inline Imported assignment references (FieldFunction delimiters, weighted entries, etc.)
  const knownAssignments = knownAssetSets.assignment;
  if (knownAssignments.size > 0) {
    for (const node of nodes) {
      const fields = getNodeFields(node);
      const inlineRefs = collectInlineImportedRefs(fields);
      for (const ref of inlineRefs) {
        if (knownAssignments.has(normalizeKnownName(ref.name))) continue;
        diagnostics.push({
          nodeId: node.id,
          message: `Imported assignment "${ref.name}" not found under Server/HytaleGenerator/Assignments`,
          severity: "warning",
          code: "assignment-import-unknown-ref",
          field: ref.fieldPath,
          meta: { assetKind: "assignment", importName: ref.name },
        });
      }
    }
  }

  // 8c3. Duplicate ExportAs names across nodes
  const exportAsOwners = new Map<string, string[]>();
  for (const node of nodes) {
    const fields = getNodeFields(node);
    const exportAs = typeof fields.ExportAs === "string" ? fields.ExportAs.trim() : "";
    if (!exportAs) continue;
    const key = normalizeKnownName(exportAs);
    const owners = exportAsOwners.get(key) ?? [];
    owners.push(node.id);
    exportAsOwners.set(key, owners);
  }
  for (const [, ownerIds] of exportAsOwners) {
    if (ownerIds.length <= 1) continue;
    const sampleNode = nodes.find((n) => n.id === ownerIds[0]);
    const sampleExportAs = sampleNode
      ? (typeof getNodeFields(sampleNode).ExportAs === "string" ? getNodeFields(sampleNode).ExportAs as string : "")
      : "";
    for (const nodeId of ownerIds) {
      diagnostics.push({
        nodeId,
        message: `Duplicate ExportAs "${sampleExportAs}" — shared by ${ownerIds.length} nodes`,
        severity: "error",
        code: "duplicate-export-as",
        field: "ExportAs",
        meta: { exportAs: sampleExportAs, ownerIds },
      });
    }
  }

  // 8c4. Prop completeness (Prefab paths, Column material/stack)
  for (const node of nodes) {
    const typeKey = node.type ?? "";
    if (typeKey === "Prop:Prefab" || getNodeType(node) === "Prefab") {
      const fields = getNodeFields(node);
      const paths = fields.WeightedPrefabPaths;
      const singlePath = typeof fields.Path === "string" ? fields.Path.trim() : "";
      const hasPaths = Array.isArray(paths) && paths.some(
        (p) => p && typeof p === "object" && typeof (p as { Path?: string }).Path === "string"
          && ((p as { Path: string }).Path).trim(),
      );
      if (!hasPaths && !singlePath) {
        diagnostics.push({
          nodeId: node.id,
          message: "Prefab prop has no prefab path — nothing will place",
          severity: "warning",
          code: "prop-prefab-incomplete",
          field: "WeightedPrefabPaths",
        });
      }
    }
    if (typeKey === "Prop:Column" || getNodeType(node) === "Column") {
      const fields = getNodeFields(node);
      const blocks = fields.ColumnBlocks;
      const hasBlocks = Array.isArray(blocks) && blocks.length > 0;
      const hasHeightMaterial = fields.Material != null && fields.Material !== "";
      if (!hasBlocks && !hasHeightMaterial) {
        diagnostics.push({
          nodeId: node.id,
          message: "Column prop has no blocks or material configured",
          severity: "warning",
          code: "prop-prefab-incomplete",
          field: "ColumnBlocks",
        });
      }
      const scanner = fields.Scanner as Record<string, unknown> | undefined;
      if (scanner?.Type === "ColumnLinear") {
        const minY = typeof scanner.MinY === "number" ? scanner.MinY : null;
        const maxY = typeof scanner.MaxY === "number" ? scanner.MaxY : null;
        if (minY != null && maxY != null && maxY - minY > 512) {
          diagnostics.push({
            nodeId: node.id,
            message: `Column scanner Y span (${maxY - minY}) exceeds 512 — may be slow or unintended`,
            severity: "warning",
            code: "column-scanner-range",
            field: "Scanner",
            meta: { minY, maxY, span: maxY - minY },
          });
        }
      }
    }
  }

  // 8d. Environment:DensityDelimited delimiter validation
  for (const node of nodes) {
    if (!isEnvironmentDensityDelimitedNode(node)) continue;
    const fields = getNodeFields(node);
    const delimiters = Array.isArray(fields.Delimiters)
      ? cloneDelimiterRecords(fields.Delimiters)
      : [];
    const issues = validateEnvironmentDelimiters(delimiters, Array.from(knownAssetSets.environment));

    for (const issue of issues) {
      const delimiter =
        issue.delimiterIndex !== undefined && issue.delimiterIndex >= 0 && issue.delimiterIndex < delimiters.length
          ? delimiters[issue.delimiterIndex]
          : null;
      const environmentReference = delimiter ? readDelimiterEnvironmentReference(delimiter) : null;
      const code =
        issue.kind === "invalid-range"
          ? "env-delimiter-invalid-range"
          : issue.kind === "missing-range"
            ? "env-delimiter-missing-range"
            : issue.kind === "overlap"
              ? "env-delimiter-overlap"
              : issue.kind === "gap"
                ? "env-delimiter-gap"
                : issue.kind === "missing-environment"
                  ? "env-delimiter-missing-environment"
                  : issue.kind === "unknown-environment"
                    ? "env-delimiter-unknown-environment"
                    : "env-delimiter-unsupported-provider";

      diagnostics.push({
        nodeId: node.id,
        message: `Environment:DensityDelimited ${issue.message}`,
        severity: issue.severity,
        code,
        field: "Delimiters",
        meta: {
          delimiterIndex: issue.delimiterIndex ?? null,
          issueKind: issue.kind,
          providerType: environmentReference?.providerType ?? null,
          rawType: environmentReference?.rawType ?? null,
          assetKind: issue.kind === "unknown-environment" ? "environment" : null,
          importName: issue.kind === "unknown-environment" ? environmentReference?.name ?? null : null,
        },
      });
    }
  }

  // 9. Cross-category connection validation
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourceType = resolveDiagnosticsTypeKey(sourceNode);
    const targetType = resolveDiagnosticsTypeKey(targetNode);
    const sh = edge.sourceHandle ?? "output";
    const th = edge.targetHandle ?? "Input";

    const sourceDef = findHandleDef(sourceType, sh);
    const targetDef = findHandleDef(targetType, th);
    if (!sourceDef || !targetDef) continue;
    if (sourceDef.category === targetDef.category) continue;

    // Check the connection matrix
    const allowed = (connectionMatrix[sourceDef.category]?.[targetDef.category] ?? 0) > 0;
    if (!allowed) {
      diagnostics.push({
        nodeId: targetNode.id,
        message: `Invalid cross-category connection: ${sourceDef.category} → ${targetDef.category} (${getNodeType(sourceNode)} → ${getNodeType(targetNode)}.${th})`,
        severity: "warning",
      });
    }
  }

  // 10. Output range mismatch hints
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourceType = getNodeType(sourceNode);
    const targetType = getNodeType(targetNode);
    const sourceRange = OUTPUT_RANGES[sourceType];
    if (!sourceRange) continue;

    // Check Clamp/SmoothClamp targets: only warn if source is entirely outside clamp range
    // V2 naming: WallA = upper bound, WallB = lower bound
    if (targetType === "Clamp" || targetType === "SmoothClamp") {
      const fields = getNodeFields(targetNode);
      // Support both V2 names (WallA/WallB) and legacy names (Min/Max) for older saved files
      const clampLower = typeof fields.WallB === "number" ? fields.WallB : typeof fields.Min === "number" ? fields.Min : undefined;
      const clampUpper = typeof fields.WallA === "number" ? fields.WallA : typeof fields.Max === "number" ? fields.Max : undefined;
      if (clampLower !== undefined && clampUpper !== undefined) {
        // Source entirely below clamp range — output will always be clampLower
        if (sourceRange[1] < clampLower) {
          diagnostics.push({
            nodeId: targetNode.id,
            message: `${sourceType} output [${sourceRange[0]}, ${sourceRange[1]}] is entirely below WallB (${clampLower}) — output will always be ${clampLower}`,
            severity: "info",
          });
        }
        // Source entirely above clamp range — output will always be clampUpper
        if (sourceRange[0] > clampUpper) {
          diagnostics.push({
            nodeId: targetNode.id,
            message: `${sourceType} output [${sourceRange[0]}, ${sourceRange[1]}] is entirely above WallA (${clampUpper}) — output will always be ${clampUpper}`,
            severity: "info",
          });
        }
      }
    }

    // Check Normalizer targets: source range vs SourceRange.Min/Max
    if (targetType === "Normalizer") {
      const fields = getNodeFields(targetNode);
      const srcRange = getRangeValues(fields.SourceRange);
      if (srcRange) {
        // Source entirely outside normalizer's expected input range
        if (sourceRange[1] < srcRange[0] || sourceRange[0] > srcRange[1]) {
          diagnostics.push({
            nodeId: targetNode.id,
            message: `${sourceType} output [${sourceRange[0]}, ${sourceRange[1]}] is entirely outside Normalizer input range [${srcRange[0]}, ${srcRange[1]}]`,
            severity: "info",
          });
        }
      }
    }
  }

  // 10b. CurveMapper curve In range vs BaseHeight Distance input
  for (const node of nodes) {
    const typeKey = getNodeType(node);
    if (typeKey !== "CurveMapper" && typeKey !== "CurveFunction") continue;

    const inputNode = resolveCurveMapperInputNode(node.id, nodes, edges);
    if (!isBaseHeightDistanceInput(inputNode)) continue;

    const inRange = getCurveMapperManualInRange(node, nodes, edges);
    if (!inRange) continue;

    if (isLikelyNormalizedCurveOnBlockOffsetInput(inRange)) {
      diagnostics.push({
        nodeId: node.id,
        message:
          `CurveMapper curve In range [${inRange.minIn}, ${inRange.maxIn}] looks normalized (0–1) but Input is BaseHeight Distance (block offsets). Use In = blocks from surface (e.g. -80…120) and Out = density — flat terrain / solid slab preview otherwise.`,
        severity: "warning",
        code: "curvemapper-in-range-mismatch",
        field: "Curve",
      });
    } else if (inRange.minOut >= 0) {
      diagnostics.push({
        nodeId: node.id,
        message:
          `CurveMapper curve Out never goes negative (min Out ${inRange.minOut}) — air may not form above the surface; Out should cross below 0 above ground.`,
        severity: "info",
        code: "curvemapper-out-range-hint",
        field: "Curve",
      });
    }
  }

  // 10c. Sum(SimplexNoise, CurveMapper(BaseHeight)) — sparse pillars / void (not Example_Curve_Mapper)
  for (const node of nodes) {
    if (getNodeType(node) !== "Sum") continue;
    if (!sumHasRawNoisePlusHeightCurveMapper(node.id, nodes, edges)) continue;
    diagnostics.push({
      nodeId: node.id,
      message:
        "Sum adds raw noise directly with a BaseHeight CurveMapper — this often yields pillars and void, not continuous ground. Use two CurveMappers like Examples/Example_Curve_Mapper.json: CurveMapper(noise) + CurveMapper(BaseHeight Distance).",
      severity: "warning",
      code: "sum-raw-noise-height-curvemapper",
    });
  }

  return diagnostics;
}

/** Walk a provider node tree and collect all string environment references */
function collectEnvRefs(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  const obj = node as Record<string, unknown>;
  const refs: string[] = [];

  if (typeof obj.Environment === "string") {
    refs.push(obj.Environment);
  }
  for (const val of Object.values(obj)) {
    if (Array.isArray(val)) {
      for (const item of val) refs.push(...collectEnvRefs(item));
    } else if (val && typeof val === "object") {
      refs.push(...collectEnvRefs(val));
    }
  }
  return refs;
}

/**
 * Analyze a biome config for Hytale-specific issues:
 * - Unknown EnvironmentProvider references
 * - Missing TintProvider
 * - TintProvider with a single-color only (no gradient)
 */
export function analyzeBiome(
  biomeConfig: Record<string, unknown> | null,
  knownAssetNames?: KnownAssetNameMap | null,
): GraphDiagnostic[] {
  if (!biomeConfig) return [];
  const diags: GraphDiagnostic[] = [];
  const knownAssetSets = buildKnownAssetNameSets(knownAssetNames);

  // Check EnvironmentProvider references
  const envProvider = biomeConfig.EnvironmentProvider;
  const envUsesServerDefault = usesServerDefaultEnvironment(envProvider);
  if (!envProvider) {
    diags.push({
      nodeId: null,
      message: "Biome has no EnvironmentProvider - worldgen will use the default environment",
      severity: "warning",
      biomeSection: "EnvironmentProvider",
      code: "biome-environment-missing-provider",
      field: "EnvironmentProvider",
    });
  } else {
    const envProviderRecord = envProvider as Record<string, unknown>;
    const envProviderType = typeof envProviderRecord.Type === "string" ? envProviderRecord.Type : null;
    const envProviderName = typeof envProviderRecord.Name === "string" ? envProviderRecord.Name.trim() : "";
    if ((envProviderType === "Imported" || envProviderType === "Exported") && !envProviderName) {
      diags.push({
        nodeId: null,
        message: `EnvironmentProvider ${envProviderType} is missing a Name reference`,
        severity: "warning",
        biomeSection: "EnvironmentProvider",
        code: "biome-environment-missing-ref-name",
        field: "Name",
        meta: { providerType: envProviderType },
      });
    }
    const refs = collectEnvRefs(envProvider);
    for (const ref of refs) {
      if (!knownAssetSets.environment.has(normalizeKnownName(ref))) {
        diags.push({
          nodeId: null,
          message: `EnvironmentProvider references unknown environment "${ref}" - not found in project or synced Hytale assets`,
          severity: "warning",
          biomeSection: "EnvironmentProvider",
          code: "biome-environment-unknown-ref",
          field: "EnvironmentProvider",
          meta: { assetKind: "environment", importName: ref, environment: ref },
        });
      }
    }
    if (
      refs.length === 0
      && !envUsesServerDefault
      && envProviderType !== "Imported"
      && envProviderType !== "Exported"
    ) {
      diags.push({
        nodeId: null,
        message: "EnvironmentProvider has no environment constants - biome will have no environment",
        severity: "warning",
        biomeSection: "EnvironmentProvider",
        code: "biome-environment-no-constants",
        field: "EnvironmentProvider",
      });
    }
  }

  // Check TintProvider
  const tintProvider = biomeConfig.TintProvider;
  if (!tintProvider) {
    diags.push({
      nodeId: null,
      message: "Biome has no TintProvider - grass and foliage will use default color",
      severity: "info",
      biomeSection: "TintProvider",
      code: "biome-tint-missing-provider",
      field: "TintProvider",
    });
  } else {
    const tp = tintProvider as Record<string, unknown>;
    const tintProviderType = typeof tp.Type === "string" ? tp.Type : null;
    const tintProviderName = typeof tp.Name === "string" ? tp.Name.trim() : "";
    if (tintProviderType === "Imported" && !tintProviderName) {
      diags.push({
        nodeId: null,
        message: "TintProvider Imported is missing a Name reference",
        severity: "warning",
        biomeSection: "TintProvider",
        code: "biome-tint-missing-ref-name",
        field: "Name",
      });
    } else if (
      tintProviderType === "Imported"
      && tintProviderName
      && knownAssetSets.tint.size > 0
      && !knownAssetSets.tint.has(normalizeKnownName(tintProviderName))
    ) {
      diags.push({
        nodeId: null,
        message: `TintProvider Imported references unknown tint "${tintProviderName}"`,
        severity: "warning",
        biomeSection: "TintProvider",
        code: "biome-tint-unknown-ref",
        field: "Name",
        meta: { assetKind: "tint", importName: tintProviderName },
      });
    }
    // A Constant tint with a single color is valid but less interesting than DensityDelimited
    if (tp.Type === "Constant") {
      diags.push({
        nodeId: null,
        message: "TintProvider is a single Constant color - consider DensityDelimited for noise-varied grass tints",
        severity: "info",
        biomeSection: "TintProvider",
      });
    }
    // DensityDelimited with no delimiters
    if (tp.Type === "DensityDelimited") {
      const delimiters = tp.Delimiters;
      if (Array.isArray(delimiters) && delimiters.length === 0) {
        diags.push({
          nodeId: null,
          message: "TintProvider DensityDelimited has no delimiters - will produce no tint variation",
          severity: "warning",
          biomeSection: "TintProvider",
        });
      }
    }
    // Check that color values in tint constants are valid hex
    function checkTintColors(obj: unknown): void {
      if (!obj || typeof obj !== "object") return;
      const o = obj as Record<string, unknown>;
      if (o.Type === "Constant" && typeof o.Color === "string") {
        if (!/^#[0-9a-fA-F]{6}$/.test(o.Color)) {
          diags.push({
            nodeId: null,
            message: `TintProvider has invalid color value "${o.Color}" - must be a 6-digit hex color`,
            severity: "error",
            biomeSection: "TintProvider",
          });
        }
      }
      for (const val of Object.values(o)) {
        if (val && typeof val === "object") checkTintColors(val);
        if (Array.isArray(val)) val.forEach(checkTintColors);
      }
    }
    checkTintColors(tintProvider);
  }

  // Check biome Name
  if (!biomeConfig.Name || typeof biomeConfig.Name !== "string" || !(biomeConfig.Name as string).trim()) {
    diags.push({
      nodeId: null,
      message: "Biome has no Name - Hytale requires a non-empty Name field",
      severity: "error",
      biomeSection: "Terrain",
      code: "biome-name-missing",
      field: "Name",
    });
  }

  return diags;
}

/**
 * Compute a fidelity score for the graph: percentage of density nodes
 * with full (accurate) evaluation status.
 */
export function computeFidelityScore(nodes: Node[]): number {
  let faithful = 0;
  let total = 0;
  for (const node of nodes) {
    const type = getNodeType(node);
    if (!type) continue;
    total++;
    if (getEvalStatus(type) === EvalStatus.Full) faithful++;
  }
  return total === 0 ? 100 : Math.round((faithful / total) * 100);
}
