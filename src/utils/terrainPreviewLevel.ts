import type { Node, Edge } from "@xyflow/react";
import { DEFAULT_WORLD_HEIGHT } from "@/constants";
import { findDensityRoot, getNodeType } from "@/utils/density/evalTypes";
import { createEvaluationContext } from "@/utils/densityEvaluator";
import type { DirectoryEntryData } from "@/utils/ipc";
import {
  getCurveMapperManualInRange,
  isBaseHeightDistanceInput,
  isLikelyNormalizedCurveOnBlockOffsetInput,
  resolveCurveMapperInputNode,
  findHeightCurveZeroDistance,
} from "@/utils/curveMapperDiagnostics";

export interface TerrainReferenceLevels {
  baseHeightName: string;
  referenceY: number;
  bedrockY?: number;
  suggestedYMin: number;
  suggestedYMax: number;
  suggestedYLevel: number;
  reason: string;
}

export interface TerrainSurfaceSample {
  minSurfaceY: number;
  maxSurfaceY: number;
  medianSurfaceY: number;
  sampleCount: number;
  rawMinSurfaceY?: number;
  rawMaxSurfaceY?: number;
}

export interface TerrainAutoFitYBounds {
  worldYMin: number;
  worldYMax: number;
  yLevel: number;
  reason: string;
}

/** Parse Hytale WorldStructure ContentFields ({ Name, Y }) or legacy ({ Name, Value }). */
export function parseContentFieldsFromWorldStructure(
  ws: Record<string, unknown>,
): Record<string, number> {
  const fields: Record<string, number> = {};
  const cfArray = ws.ContentFields;
  if (!Array.isArray(cfArray)) return fields;

  for (const cf of cfArray) {
    if (!cf || typeof cf !== "object") continue;
    const rec = cf as Record<string, unknown>;
    const name = rec.Name;
    if (typeof name !== "string" || !name.trim()) continue;
    const yRaw = rec.Y ?? rec.Value;
    const y = typeof yRaw === "number" ? yRaw : Number(yRaw);
    if (Number.isFinite(y)) {
      fields[name.trim()] = y;
    }
  }
  return fields;
}

export function worldStructureReferencesBiome(
  ws: Record<string, unknown>,
  biomeName: string,
): boolean {
  const def = ws.DefaultBiome;
  if (typeof def === "string" && def === biomeName) return true;

  const biomes = ws.Biomes;
  if (!Array.isArray(biomes)) return false;
  for (const entry of biomes) {
    if (!entry || typeof entry !== "object") continue;
    const name = (entry as Record<string, unknown>).Biome;
    if (name === biomeName) return true;
  }
  return false;
}

export function inferBiomeNameFromFile(
  wrapper: Record<string, unknown>,
  filePath: string,
): string {
  const name = wrapper.Name;
  if (typeof name === "string" && name.trim()) return name.trim();
  const base = filePath.replace(/\\/g, "/").split("/").pop() ?? "";
  return base.replace(/\.json$/i, "");
}

/** Resolve WorldStructures dir from a biome JSON path under HytaleGenerator/Biomes. */
export function worldStructuresDirFromBiomePath(biomeFilePath: string): string | null {
  const normalized = biomeFilePath.replace(/\\/g, "/");
  const match = normalized.match(/^(.*\/HytaleGenerator)\/Biomes\/[^/]+$/i);
  if (match) return `${match[1]}/WorldStructures`;
  const parent = normalized.replace(/\/[^/]+$/, "");
  const grandparent = parent.replace(/\/[^/]+$/, "");
  return `${grandparent}/WorldStructures`;
}

/**
 * Load ContentFields for a biome: exact WS name, DefaultBiome match, then MainWorld.json.
 */
export async function discoverContentFieldsForBiome(
  biomeFilePath: string,
  biomeName: string,
  readFile: (path: string) => Promise<unknown>,
  listDir: (path: string) => Promise<DirectoryEntryData[]>,
): Promise<Record<string, number> | undefined> {
  const wsDir = worldStructuresDirFromBiomePath(biomeFilePath);
  if (!wsDir) return undefined;

  let entries: DirectoryEntryData[];
  try {
    entries = await listDir(wsDir);
  } catch {
    return undefined;
  }

  const jsonFiles = entries.filter((e) => !e.is_dir && e.name.endsWith(".json"));
  const pathsToTry: string[] = [];
  const seen = new Set<string>();

  const pushPath = (rel: string) => {
    const full = `${wsDir}/${rel}`;
    if (seen.has(full)) return;
    seen.add(full);
    pathsToTry.push(full);
  };

  if (jsonFiles.some((e) => e.name === `${biomeName}.json`)) {
    pushPath(`${biomeName}.json`);
  }

  for (const entry of jsonFiles) {
    if (entry.name === `${biomeName}.json`) continue;
    try {
      const content = await readFile(`${wsDir}/${entry.name}`);
      if (
        content
        && typeof content === "object"
        && worldStructureReferencesBiome(content as Record<string, unknown>, biomeName)
      ) {
        pushPath(entry.name);
      }
    } catch {
      // skip unreadable WS
    }
  }

  if (jsonFiles.some((e) => e.name === "MainWorld.json")) {
    pushPath("MainWorld.json");
  }

  for (const path of pathsToTry) {
    try {
      const content = await readFile(path);
      if (!content || typeof content !== "object") continue;
      const fields = parseContentFieldsFromWorldStructure(content as Record<string, unknown>);
      if (Object.keys(fields).length > 0) return fields;
    } catch {
      // try next candidate
    }
  }

  return undefined;
}

export function findPrimaryBaseHeightName(nodes: Node[]): string | null {
  for (const node of nodes) {
    if (getNodeType(node) !== "BaseHeight") continue;
    const fields = (node.data as Record<string, unknown>).fields as Record<string, unknown> | undefined;
    const name = fields?.BaseHeightName;
    if (typeof name === "string" && name.trim()) return name.trim();
    return "Base";
  }
  return null;
}

/** Vertical extent above base from height CurveMapper curves + noise branch margin. */
export function estimateTerrainVerticalExtent(
  nodes: Node[],
  edges: Edge[],
): { heightCurveMaxIn: number; noiseMargin: number } {
  let heightCurveMaxIn = 0;
  let noiseMargin = 24;

  for (const node of nodes) {
    if (getNodeType(node) !== "CurveMapper") continue;
    const inputNode = resolveCurveMapperInputNode(node.id, nodes, edges);
    const inRange = getCurveMapperManualInRange(node, nodes, edges);
    if (!inRange) continue;

    if (isBaseHeightDistanceInput(inputNode)) {
      if (!isLikelyNormalizedCurveOnBlockOffsetInput(inRange)) {
        heightCurveMaxIn = Math.max(heightCurveMaxIn, inRange.maxIn);
      }
      continue;
    }

    const outSpan = Math.max(Math.abs(inRange.minOut), Math.abs(inRange.maxOut));
    noiseMargin = Math.max(noiseMargin, Math.ceil(outSpan * 24));
  }

  return { heightCurveMaxIn, noiseMargin };
}

function resolveBedrockY(contentFields: Record<string, number>): number | undefined {
  const bedrock = contentFields.Bedrock;
  return typeof bedrock === "number" && Number.isFinite(bedrock) ? bedrock : undefined;
}

function effectiveBelowPad(
  referenceY: number,
  bedrockY: number | undefined,
  requestedPad: number,
): number {
  if (bedrockY == null) return requestedPad;
  const toBedrock = referenceY - bedrockY;
  return Math.min(requestedPad, Math.max(12, toBedrock + 8));
}

function effectiveAbovePad(
  heightCurveMaxIn: number,
  noiseMargin: number,
  surfaceSpan: number,
): number {
  const curvePad = Math.ceil(heightCurveMaxIn + noiseMargin);
  const spanPad = surfaceSpan > 0 ? Math.ceil(surfaceSpan * 0.35 + 12) : 0;
  return Math.max(24, curvePad, spanPad);
}

/** Nominal terrain surface Y: profile zero-crossing or ContentFields base directly. */
function resolveNominalSurfaceY(
  referenceY: number,
  heightZeroDist: number,
  useBaseY: boolean,
): number {
  return useBaseY ? referenceY : referenceY + heightZeroDist;
}

export interface TerrainPreviewOptions {
  /** When true, anchor on ContentFields base Y instead of profile zero-crossing. */
  useBaseY?: boolean;
  belowPad?: number;
  caveCarving?: boolean;
  /** Alias for caveCarving — extends vertical search for voids / rivers. */
  undergroundCarving?: boolean;
  surfaceSample?: TerrainSurfaceSample | null;
}

/** Probe zero-crossings on a coarse XZ grid to find the actual surface band. */
export function sampleTerrainSurfaceCrossings(
  nodes: Node[],
  edges: Edge[],
  contentFields: Record<string, number>,
  options?: {
    rootNodeId?: string;
    rangeMin?: number;
    rangeMax?: number;
    ySearchMin?: number;
    ySearchMax?: number;
    xzSamples?: number;
    useBaseY?: boolean;
    undergroundCarving?: boolean;
    belowPad?: number;
  },
): TerrainSurfaceSample | null {
  const root = options?.rootNodeId
    ? nodes.find((n) => n.id === options.rootNodeId) ?? findDensityRoot(nodes, edges)
    : findDensityRoot(nodes, edges);
  if (!root) return null;

  const ctx = createEvaluationContext(nodes, edges, root.id, { contentFields });
  if (!ctx) return null;

  const baseName = findPrimaryBaseHeightName(nodes);
  const baseY = baseName
    ? (contentFields[baseName] ?? contentFields.Base ?? 100)
    : (contentFields.Base ?? 100);
  const { heightCurveMaxIn, noiseMargin } = estimateTerrainVerticalExtent(nodes, edges);
  const heightZeroDist = findHeightCurveZeroDistance(nodes, edges) ?? 0;
  const useBaseY = options?.useBaseY ?? false;
  const nominalSurfaceY = resolveNominalSurfaceY(baseY, heightZeroDist, useBaseY);

  const rangeMin = options?.rangeMin ?? -64;
  const rangeMax = options?.rangeMax ?? 64;
  const underground = options?.undergroundCarving ?? false;
  const belowDepth = options?.belowPad ?? (underground ? 80 : 50);
  const ySearchMin = options?.ySearchMin ?? Math.max(0, nominalSurfaceY - belowDepth);
  const ySearchMax = options?.ySearchMax ?? Math.min(
    DEFAULT_WORLD_HEIGHT,
    nominalSurfaceY + (useBaseY
      ? Math.max(40, noiseMargin + 40)
      : Math.max(40, heightCurveMaxIn - heightZeroDist + noiseMargin + 20)),
  );
  const xzSamples = options?.xzSamples ?? 7;

  const crossingYs: number[] = [];
  for (let xi = 0; xi < xzSamples; xi++) {
    const wx = rangeMin + (xi / Math.max(1, xzSamples - 1)) * (rangeMax - rangeMin);
    for (let zi = 0; zi < xzSamples; zi++) {
      const wz = rangeMin + (zi / Math.max(1, xzSamples - 1)) * (rangeMax - rangeMin);
      let bestCrossing: number | null = null;
      let bestDist = Infinity;
      for (let y = ySearchMin; y < ySearchMax; y++) {
        const d0 = ctx.evaluate(root.id, wx, y, wz);
        const d1 = ctx.evaluate(root.id, wx, y + 1, wz);
        if (d0 >= 0 && d1 < 0) {
          const t = Math.abs(d0) / (Math.abs(d0) + Math.abs(d1) || 1);
          const crossY = y + t;
          const dist = Math.abs(crossY - nominalSurfaceY);
          if (dist < bestDist) {
            bestDist = dist;
            bestCrossing = crossY;
          }
        }
      }
      if (bestCrossing != null) crossingYs.push(bestCrossing);
    }
  }

  if (crossingYs.length === 0) return null;

  crossingYs.sort((a, b) => a - b);

  const percentile = (p: number) => {
    const idx = (crossingYs.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return crossingYs[lo];
    return crossingYs[lo] + (crossingYs[hi] - crossingYs[lo]) * (idx - lo);
  };

  const rawMin = crossingYs[0];
  const rawMax = crossingYs[crossingYs.length - 1];
  const softCap = Math.min(
    DEFAULT_WORLD_HEIGHT,
    nominalSurfaceY + (useBaseY
      ? Math.max(noiseMargin + 16, 48)
      : Math.max(noiseMargin + 16, (heightCurveMaxIn - heightZeroDist) * 0.35 + noiseMargin)),
  );

  return {
    minSurfaceY: percentile(0.2),
    maxSurfaceY: Math.min(percentile(0.8), softCap),
    medianSurfaceY: percentile(0.5),
    sampleCount: crossingYs.length,
    rawMinSurfaceY: rawMin,
    rawMaxSurfaceY: rawMax,
  };
}

/**
 * Resolve the world Y where terrain is expected to generate (ContentFields + graph).
 * Used to seed voxel preview Y bounds before the first volume pass.
 */
export function resolveTerrainReferenceLevels(
  nodes: Node[],
  edges: Edge[],
  contentFields: Record<string, number>,
  options?: TerrainPreviewOptions,
): TerrainReferenceLevels | null {
  const baseName = findPrimaryBaseHeightName(nodes);
  if (!baseName) return null;

  const referenceY = contentFields[baseName] ?? contentFields.Base ?? 100;
  const bedrockY = resolveBedrockY(contentFields);
  const heightZeroDist = findHeightCurveZeroDistance(nodes, edges) ?? 0;
  const useBaseY = options?.useBaseY ?? false;
  const nominalSurfaceY = resolveNominalSurfaceY(referenceY, heightZeroDist, useBaseY);
  const underground = options?.caveCarving ?? options?.undergroundCarving ?? false;
  const requestedBelow = options?.belowPad ?? (underground ? 80 : 50);
  const belowPad = effectiveBelowPad(nominalSurfaceY, bedrockY, requestedBelow);
  const { heightCurveMaxIn, noiseMargin } = estimateTerrainVerticalExtent(nodes, edges);
  const sample = options?.surfaceSample;
  const surfaceSpan = sample && sample.sampleCount > 0
    ? sample.maxSurfaceY - sample.minSurfaceY
    : 0;
  const aboveCurveExtent = useBaseY ? 0 : Math.max(0, heightCurveMaxIn - heightZeroDist);
  const abovePad = effectiveAbovePad(aboveCurveExtent, noiseMargin, surfaceSpan);

  const parts = [`ContentFields.${baseName} = ${referenceY}`];
  if (useBaseY) {
    parts.push("anchored to Base Y");
  } else if (heightZeroDist > 0) {
    parts.push(`profile zero at +${Math.round(heightZeroDist)} blocks`);
  }
  if (heightCurveMaxIn > 0 && !useBaseY) parts.push(`height curve to +${Math.ceil(heightCurveMaxIn)}`);
  if (sample && sample.sampleCount > 0) {
    parts.push(`surface Y ${Math.round(sample.minSurfaceY)}–${Math.round(sample.maxSurfaceY)}`);
  }

  let suggestedYMin = Math.max(0, Math.floor(nominalSurfaceY - belowPad));
  let suggestedYMax = Math.min(DEFAULT_WORLD_HEIGHT, Math.ceil(nominalSurfaceY + abovePad));
  let suggestedYLevel = Math.round(useBaseY ? referenceY : nominalSurfaceY);

  if (sample && sample.sampleCount > 0) {
    const belowSample = underground
      ? belowPad
      : Math.max(8, Math.min(belowPad, Math.ceil(surfaceSpan * 0.2 + 8)));
    const aboveSample = Math.max(10, Math.min(abovePad, Math.ceil(surfaceSpan * 0.25 + 10)));
    if (useBaseY) {
      suggestedYMin = Math.max(
        bedrockY ?? 0,
        Math.floor(Math.min(referenceY - belowPad, sample.minSurfaceY - belowSample)),
      );
      suggestedYMax = Math.min(
        DEFAULT_WORLD_HEIGHT,
        Math.ceil(Math.max(referenceY + abovePad, sample.maxSurfaceY + aboveSample)),
      );
      suggestedYLevel = Math.round(referenceY);
    } else {
      suggestedYMin = Math.max(
        bedrockY ?? 0,
        Math.floor(sample.minSurfaceY - belowSample),
      );
      suggestedYMax = Math.min(
        DEFAULT_WORLD_HEIGHT,
        Math.ceil(sample.maxSurfaceY + aboveSample),
      );
      suggestedYLevel = Math.round(sample.medianSurfaceY);
    }
  }

  return {
    baseHeightName: baseName,
    referenceY,
    bedrockY,
    suggestedYMin,
    suggestedYMax,
    suggestedYLevel,
    reason: parts.join("; "),
  };
}

/** Best-effort auto-fit Y window from graph analysis (static + surface probe). */
export function computeTerrainAutoFitYBounds(
  nodes: Node[],
  edges: Edge[],
  contentFields: Record<string, number>,
  options?: {
    caveCarving?: boolean;
    undergroundCarving?: boolean;
    belowPad?: number;
    rangeMin?: number;
    rangeMax?: number;
    rootNodeId?: string;
    useBaseY?: boolean;
  },
): TerrainAutoFitYBounds | null {
  const useBaseY = options?.useBaseY ?? false;
  const underground = options?.caveCarving ?? options?.undergroundCarving ?? false;
  const belowPad = options?.belowPad ?? (underground ? 80 : 50);
  const sample = sampleTerrainSurfaceCrossings(nodes, edges, contentFields, {
    rootNodeId: options?.rootNodeId,
    rangeMin: options?.rangeMin,
    rangeMax: options?.rangeMax,
    useBaseY,
    undergroundCarving: underground,
    belowPad,
  });
  const ref = resolveTerrainReferenceLevels(nodes, edges, contentFields, {
    caveCarving: underground,
    belowPad,
    surfaceSample: sample,
    useBaseY,
  });
  if (!ref) return null;

  return {
    worldYMin: ref.suggestedYMin,
    worldYMax: ref.suggestedYMax,
    yLevel: ref.suggestedYLevel,
    reason: ref.reason,
  };
}
