import type { Node, Edge } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";
import type { BiomeMaterialConfig } from "@/utils/materialResolver";
import { detectHydrographyContext } from "@/utils/hydrographyContext";
import {
  getCurveMapperManualInRange,
  isBaseHeightDistanceInput,
  isLikelyNormalizedCurveOnBlockOffsetInput,
  resolveCurveMapperInputNode,
} from "@/utils/curveMapperDiagnostics";

/** Node types commonly used in carve branches (compositional caves). */
const CARVE_BRANCH_TYPES = new Set([
  "SimplexNoise3D",
  "CellNoise3D",
  "Inverter",
  "SmoothClamp",
  "Negate",
  "CaveDensity",
]);

/** SDF primitives often wired into Min/SmoothMin to carve voids. */
const CARVE_PRIMITIVE_TYPES = new Set([
  "Ellipsoid",
  "Cuboid",
  "Cylinder",
  "Sphere",
]);

const MIN_COMBINER_TYPES = new Set(["Min", "SmoothMin"]);

const CAVE_IMPORT_PATTERN = /caves?|underworld|deeproot|snake|cavern|hive|cave_/i;
const RIVER_IMPORT_PATTERN = /river|world-river/i;
const CAVE_NOISE_SEED_PATTERN = /^caves?[-_]/i;

export interface GraphPreviewFeatures {
  /** Compositional caves, legacy CaveDensity, boolean subtract, SDF carve into Min. */
  undergroundCarving: boolean;
  /** @deprecated Use undergroundCarving — kept for existing call sites. */
  caveCarving: boolean;
  /** Shipped-style cave module via Imported density (Plains1_Caves_*, etc.). */
  importedCaveModule: boolean;
  /** River map / cliff river density imports (World-River-Map, *River*). */
  importedRiverModule: boolean;
  /** BeardDensity / overhang-style nodes in the graph. */
  overhangEmphasis: boolean;
  /** Gradient(Terrain) or Terrain reference in the density tree. */
  terrainReference: boolean;
  /** Biome has a resolvable water/fluid surface (rivers, lakes, shores). */
  hydrography: boolean;
  waterSurfaceY: number | null;
  /** Extra blocks below nominal surface for voxel Y min / surface probe. */
  belowPad: number;
  /** Human-readable tags for debug toasts / inspector hints. */
  tags: string[];
}

export interface CaveVerticalExtent {
  minIn: number;
  maxIn: number;
}

function buildUpstreamIndex(edges: Edge[]): Map<string, string[]> {
  const upstream = new Map<string, string[]>();
  for (const edge of edges) {
    if (!upstream.has(edge.target)) upstream.set(edge.target, []);
    upstream.get(edge.target)!.push(edge.source);
  }
  return upstream;
}

function visitUpstreamTypes(
  startId: string,
  types: Map<string, string>,
  upstream: Map<string, string[]>,
  match: Set<string>,
): boolean {
  const seen = new Set<string>();
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const t = types.get(id);
    if (t && match.has(t)) return true;
    for (const src of upstream.get(id) ?? []) stack.push(src);
  }
  return false;
}

function nodeFields(node: Node): Record<string, unknown> {
  return ((node.data as Record<string, unknown>)?.fields as Record<string, unknown>) ?? {};
}

function importedName(node: Node): string {
  return String(nodeFields(node).Name ?? nodeFields(node).ExportAs ?? "").trim();
}

/** Detect Imported density names matching release cave modules (*Caves*, *Cave*, etc.). */
export function graphHasImportedCaveModule(nodes: Node[]): boolean {
  return nodes.some((n) => {
    const t = getNodeType(n);
    if (t !== "Imported" && t !== "ImportedValue") return false;
    return CAVE_IMPORT_PATTERN.test(importedName(n));
  });
}

/** Detect Imported river density (World-River-Map, Desert1_Rivers, …). */
export function graphHasImportedRiverModule(nodes: Node[]): boolean {
  return nodes.some((n) => {
    const t = getNodeType(n);
    if (t !== "Imported" && t !== "ImportedValue") return false;
    return RIVER_IMPORT_PATTERN.test(importedName(n));
  });
}

/** Release Plains-style 2D snake cave noise seeds (Cave-Floor, Caves-Snakes, …). */
export function graphHasSnakeCaveNoise(nodes: Node[]): boolean {
  return nodes.some((n) => {
    if (getNodeType(n) !== "SimplexNoise2D") return false;
    const seed = String(nodeFields(n).Seed ?? "");
    return CAVE_NOISE_SEED_PATTERN.test(seed);
  });
}

/** BaseHeight Distance + CurveMapper stacks used for underground bands in release caves. */
export function graphHasBaseHeightDistanceCaveStack(nodes: Node[], edges: Edge[]): boolean {
  for (const node of nodes) {
    if (getNodeType(node) !== "CurveMapper") continue;
    const inputNode = resolveCurveMapperInputNode(node.id, nodes, edges);
    if (!isBaseHeightDistanceInput(inputNode)) continue;
    const inRange = getCurveMapperManualInRange(node, nodes, edges);
    if (!inRange || isLikelyNormalizedCurveOnBlockOffsetInput(inRange)) continue;
    if (inRange.minIn < -12) return true;
  }
  return false;
}

/** Min/max In from BaseHeight Distance CurveMappers — drives preview below-pad. */
export function inferCaveVerticalExtentFromCurves(
  nodes: Node[],
  edges: Edge[],
): CaveVerticalExtent | null {
  let minIn = Infinity;
  let maxIn = -Infinity;
  for (const node of nodes) {
    if (getNodeType(node) !== "CurveMapper") continue;
    const inputNode = resolveCurveMapperInputNode(node.id, nodes, edges);
    if (!isBaseHeightDistanceInput(inputNode)) continue;
    const inRange = getCurveMapperManualInRange(node, nodes, edges);
    if (!inRange || isLikelyNormalizedCurveOnBlockOffsetInput(inRange)) continue;
    minIn = Math.min(minIn, inRange.minIn);
    maxIn = Math.max(maxIn, inRange.maxIn);
  }
  if (!Number.isFinite(minIn)) return null;
  return { minIn, maxIn };
}

/** Detect Min/SmoothMin graphs with carve branches (noise, inverter, SDF, CaveDensity). */
export function graphHasUndergroundCarving(nodes: Node[], edges: Edge[]): boolean {
  if (graphHasImportedCaveModule(nodes)) return true;
  if (graphHasSnakeCaveNoise(nodes)) return true;
  if (graphHasBaseHeightDistanceCaveStack(nodes, edges)) return true;

  const types = new Map(nodes.map((n) => [n.id, getNodeType(n)]));
  const upstream = buildUpstreamIndex(edges);

  for (const node of nodes) {
    const t = types.get(node.id);
    if (t === "CaveDensity") return true;

    if (t === "TerrainBoolean") {
      const op = String(nodeFields(node).Operation ?? "Union");
      if (op === "Subtraction") return true;
    }

    if (!t || !MIN_COMBINER_TYPES.has(t)) continue;
    for (const src of upstream.get(node.id) ?? []) {
      if (
        visitUpstreamTypes(src, types, upstream, CARVE_BRANCH_TYPES)
        || visitUpstreamTypes(src, types, upstream, CARVE_PRIMITIVE_TYPES)
      ) {
        return true;
      }
    }
  }
  return false;
}

/** @deprecated Prefer graphHasUndergroundCarving or analyzeGraphPreviewFeatures. */
export function graphHasCaveCarving(nodes: Node[], edges: Edge[]): boolean {
  return graphHasUndergroundCarving(nodes, edges);
}

export function graphHasOverhangEmphasis(nodes: Node[]): boolean {
  return nodes.some((n) => {
    const t = getNodeType(n);
    return t === "BeardDensity" || t === "Beard";
  });
}

export function graphHasTerrainReference(nodes: Node[]): boolean {
  return nodes.some((n) => {
    const t = getNodeType(n);
    return t === "Terrain" || t === "Gradient" || t === "BaseHeight";
  });
}

export function computePreviewBelowPad(
  features: Pick<
    GraphPreviewFeatures,
    "undergroundCarving" | "overhangEmphasis" | "hydrography" | "importedCaveModule"
  >,
  curveExtent?: CaveVerticalExtent | null,
): number {
  let pad = 50;
  if (features.undergroundCarving) pad = Math.max(pad, 80);
  if (features.importedCaveModule) pad = Math.max(pad, 90);
  if (features.overhangEmphasis) pad = Math.max(pad, 64);
  if (features.hydrography && !features.undergroundCarving) pad = Math.max(pad, 56);

  if (curveExtent) {
    const belowBlocks = Math.abs(Math.min(0, curveExtent.minIn));
    pad = Math.max(pad, Math.ceil(belowBlocks + 16));
  }

  return pad;
}

/**
 * Static analysis of density graph + biome context for preview auto-fit,
 * Y bounds, and slice defaults (caves, rivers, overhangs).
 */
export function analyzeGraphPreviewFeatures(
  nodes: Node[],
  edges: Edge[],
  contentFields: Record<string, number>,
  materialConfig?: BiomeMaterialConfig | null,
): GraphPreviewFeatures {
  const importedCaveModule = graphHasImportedCaveModule(nodes);
  const importedRiverModule = graphHasImportedRiverModule(nodes);
  const undergroundCarving = graphHasUndergroundCarving(nodes, edges);
  const overhangEmphasis = graphHasOverhangEmphasis(nodes);
  const terrainReference = graphHasTerrainReference(nodes);
  const hydroFromMaterial = detectHydrographyContext(materialConfig ?? null, contentFields);
  const hydrography = hydroFromMaterial.enabled || importedRiverModule;
  const curveExtent = inferCaveVerticalExtentFromCurves(nodes, edges);

  const tags: string[] = [];
  if (importedCaveModule) tags.push("imported caves");
  if (importedRiverModule) tags.push("imported rivers");
  if (undergroundCarving) tags.push("underground carving");
  if (overhangEmphasis) tags.push("overhangs");
  if (hydrography) tags.push("hydrography");
  if (terrainReference) tags.push("terrain reference");

  const belowPad = computePreviewBelowPad(
    { undergroundCarving, overhangEmphasis, hydrography, importedCaveModule },
    curveExtent,
  );

  return {
    undergroundCarving,
    caveCarving: undergroundCarving,
    importedCaveModule,
    importedRiverModule,
    overhangEmphasis,
    terrainReference,
    hydrography,
    waterSurfaceY: hydroFromMaterial.waterSurfaceY,
    belowPad,
    tags,
  };
}

/**
 * Pick a 2D slice Y level: terrain median wins for caves; water surface for
 * hydro-only shore/river biomes when no underground carving is detected.
 */
export function suggestPreviewYLevel(
  features: GraphPreviewFeatures,
  fallbackY: number,
  terrainMedianY?: number,
): number {
  if (terrainMedianY != null && Number.isFinite(terrainMedianY)) {
    if (features.undergroundCarving) {
      return Math.round(terrainMedianY);
    }
    if (!features.hydrography) {
      return Math.round(terrainMedianY);
    }
  }

  if (features.hydrography && features.waterSurfaceY != null && !features.undergroundCarving) {
    return Math.round(features.waterSurfaceY);
  }

  return Math.round(fallbackY);
}
