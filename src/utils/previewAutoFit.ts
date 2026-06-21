import type { Node, Edge } from "@xyflow/react";
import { isGraphNode } from "@/utils/annotationUtils";
import { createVolumeWorkerInstance } from "./volumeWorkerClient";
import { enrichPreviewContentFields } from "./densityEvaluator";
import { DEFAULT_WORLD_HEIGHT } from "@/constants";
import { resolveTerrainReferenceLevels, computeTerrainAutoFitYBounds, expandVoxelYBoundsToIncludeSurface } from "@/utils/terrainPreviewLevel";
import type { TerrainAutoFitYBounds } from "@/utils/terrainPreviewLevel";
import type { BiomeMaterialConfig } from "@/utils/materialResolver";
import {
  analyzeGraphPreviewFeatures,
  graphHasCaveCarving,
  graphHasUndergroundCarving,
  suggestPreviewYLevel,
} from "@/utils/graphPreviewFeatures";
import { isTauriRuntime } from "@/utils/platform";
import { scanVolumeSolidsBounds } from "@/utils/previewBoundsIpc";

export { graphHasCaveCarving, graphHasUndergroundCarving };

// ---------------------------------------------------------------------------
// Feature 1: Auto-fit Y Bounds — scan density grid after coarse pass
// ---------------------------------------------------------------------------

export interface YBoundsResult {
  worldYMin: number;
  worldYMax: number;
  hasSolids: boolean;
}

/**
 * Threshold above which a Y slice is considered "fully underground" —
 * not interesting to frame the camera around.
 */
const UNDERGROUND_FRACTION = 0.92;

/**
 * Scans a density grid (Y-major layout: densities[yi * n * n + zi * n + xi])
 * to find the surface band — Y slices where solid/air transitions happen —
 * then frames the view around that band instead of the raw solid bounding box.
 *
 * For terrain graphs this avoids showing a massive underground block with the
 * interesting surface barely visible at the top.  For SDFs floating in space
 * every non-empty slice is a "surface" slice so the result is equivalent to a
 * simple bounding box.
 */
export function scanDensityGridYBounds(
  densities: Float32Array,
  resolution: number,
  ySlices: number,
  yMin: number,
  yMax: number,
  padding?: { belowBlocks?: number; aboveFraction?: number; aboveMinBlocks?: number },
): YBoundsResult {
  const n = resolution;
  const totalPerSlice = n * n;
  const belowPad = padding?.belowBlocks ?? 12;
  const aboveFrac = padding?.aboveFraction ?? 0.20;
  const aboveMinPad = padding?.aboveMinBlocks ?? 10;

  // 1. Count solid voxels per Y slice
  const solidCounts = new Uint32Array(ySlices);
  for (let yi = 0; yi < ySlices; yi++) {
    const base = yi * n * n;
    let count = 0;
    for (let zi = 0; zi < n; zi++) {
      const rowBase = base + zi * n;
      for (let xi = 0; xi < n; xi++) {
        if (densities[rowBase + xi] >= 0) count++;
      }
    }
    solidCounts[yi] = count;
  }

  // 2. Find first/last slice with any solid
  let firstSolid = -1;
  let lastSolid = -1;
  for (let yi = 0; yi < ySlices; yi++) {
    if (solidCounts[yi] > 0) {
      if (firstSolid < 0) firstSolid = yi;
      lastSolid = yi;
    }
  }

  if (firstSolid < 0) {
    return { worldYMin: yMin, worldYMax: yMax, hasSolids: false };
  }

  // 3. Identify the "surface band" — slices that are NOT fully underground.
  //    A slice with solid fraction >= UNDERGROUND_FRACTION that sits below a
  //    less-solid slice is dense underground and not interesting to frame.
  //    Walk upward from firstSolid to find where the surface begins.
  let surfaceBottom = firstSolid;
  for (let yi = firstSolid; yi <= lastSolid; yi++) {
    const fraction = solidCounts[yi] / totalPerSlice;
    if (fraction < UNDERGROUND_FRACTION) {
      // This slice has a mix of solid and air — surface starts here (or earlier).
      // Back up one slice so we include the transition edge.
      surfaceBottom = Math.max(firstSolid, yi - 1);
      break;
    }
    // Still fully underground — keep walking up
    surfaceBottom = yi;
  }

  // 4. Find the top of the surface band (last slice with any solid).
  //    For the top we always use lastSolid — there's no "fully air" problem.
  const surfaceTop = lastSolid;

  // 5. Convert to world Y with asymmetric padding:
  //    - Below: small fixed amount (some underground context)
  //    - Above: proportional + minimum (sky space)
  const yRange = yMax - yMin;
  const sliceToWorld = (slice: number) => yMin + (slice / ySlices) * yRange;

  const rawMin = sliceToWorld(surfaceBottom);
  const rawMax = sliceToWorld(surfaceTop + 1);
  const surfaceSpan = rawMax - rawMin;
  const abovePad = Math.max(surfaceSpan * aboveFrac, aboveMinPad);

  const worldYMin = Math.max(0, Math.floor(rawMin - belowPad));
  const worldYMax = Math.min(DEFAULT_WORLD_HEIGHT, Math.ceil(rawMax + abovePad));

  return { worldYMin, worldYMax, hasSolids: true };
}

/**
 * Merge coarse density-grid scan with graph-derived terrain bounds.
 * Prevents low-res scans from clipping peaks/valleys the static probe already found.
 */
export function mergeScanWithTerrainAutoFit(
  scanned: YBoundsResult,
  terrain: TerrainAutoFitYBounds | null,
): YBoundsResult {
  if (!scanned.hasSolids || !terrain) return scanned;

  const scanSpan = scanned.worldYMax - scanned.worldYMin;
  const terrainSpan = terrain.worldYMax - terrain.worldYMin;

  // Coarse scan often includes a thick underground column — prefer the tighter terrain band
  // when the scan window is much wider than the probed surface span.
  if (scanSpan > terrainSpan * 1.8) {
    return {
      worldYMin: terrain.worldYMin,
      worldYMax: terrain.worldYMax,
      hasSolids: true,
    };
  }

  // Union: never let a scan window clip below the graph-derived surface band (e.g. Y max < Base).
  return {
    worldYMin: Math.min(scanned.worldYMin, terrain.worldYMin),
    worldYMax: Math.max(scanned.worldYMax, terrain.worldYMax),
    hasSolids: true,
  };
}

// ---------------------------------------------------------------------------
// Graph hash — detect when graph output could change
// ---------------------------------------------------------------------------

/**
 * Computes a hash string from graph topology + field values.
 * Changes when graph output could change, but NOT when only Y bounds change.
 */
export function computeGraphHash(nodes: Node[], edges: Edge[]): string {
  const parts: string[] = [];

  const graphNodes = nodes.filter(isGraphNode);
  const graphIds = new Set(graphNodes.map((node) => node.id));
  const graphEdges = edges.filter(
    (edge) => graphIds.has(edge.source) && graphIds.has(edge.target),
  );

  // Sort nodes by ID for determinism
  const sorted = [...graphNodes].sort((a, b) => a.id.localeCompare(b.id));
  for (const node of sorted) {
    parts.push(node.id);
    parts.push(String(node.type ?? ""));
    // Include field values (these affect evaluation output)
    const fields = (node.data as Record<string, unknown>)?.fields;
    if (fields && typeof fields === "object") {
      const fieldKeys = Object.keys(fields as Record<string, unknown>).sort();
      for (const k of fieldKeys) {
        parts.push(k);
        parts.push(JSON.stringify((fields as Record<string, unknown>)[k]));
      }
    }
  }

  // Include edge topology
  const sortedEdges = [...graphEdges].sort((a, b) => a.id.localeCompare(b.id));
  for (const e of sortedEdges) {
    parts.push(`${e.source}->${e.target}:${e.sourceHandle ?? ""}:${e.targetHandle ?? ""}`);
  }

  // Simple string hash — doesn't need to be cryptographic
  const str = parts.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash.toString(36);
}

export interface EvaluationFingerprintInput {
  nodes: Node[];
  edges: Edge[];
  contentFields?: Record<string, unknown>;
  rootNodeId?: string | null;
  /** How the preview root was chosen — must match evaluation for cache identity. */
  rootSource?: string;
  materialConfig?: unknown;
}

/**
 * Fingerprint for preview/voxel evaluation — changes only when output could change.
 * Canvas layout (node x/y, frame size, comments) is intentionally excluded.
 */
/** Bump when density/voxel evaluation semantics change (invalidates preview caches). */
export const PREVIEW_EVAL_ENGINE_REV = 2;

export function computeEvaluationFingerprint(input: EvaluationFingerprintInput): string {
  const base = computeGraphHash(input.nodes, input.edges);
  const root = input.rootNodeId ?? "";
  const rootSource = input.rootSource ?? "";
  const content = input.contentFields ? JSON.stringify(input.contentFields) : "";
  const material = input.materialConfig ? JSON.stringify(input.materialConfig) : "";
  return `rev:${PREVIEW_EVAL_ENGINE_REV}|${base}|r:${root}|rs:${rootSource}|c:${content}|m:${material}`;
}

// ---------------------------------------------------------------------------
// Feature 2: Fit to Content — scan full 3D bounds
// ---------------------------------------------------------------------------

export interface Bounds3DResult {
  worldXMin: number;
  worldXMax: number;
  worldYMin: number;
  worldYMax: number;
  worldZMin: number;
  worldZMax: number;
  hasSolids: boolean;
}

export interface FitToContentApply {
  rangeMin: number;
  rangeMax: number;
  voxelYMin: number;
  voxelYMax: number;
  yLevel?: number;
}

/** Convert a 3D bounds scan into preview range/Y updates (symmetric XZ). */
export function fitToContentBoundsFromResult(bounds: Bounds3DResult): FitToContentApply | null {
  if (!bounds.hasSolids) return null;
  const xzExtent = Math.max(
    Math.abs(bounds.worldXMin),
    Math.abs(bounds.worldXMax),
    Math.abs(bounds.worldZMin),
    Math.abs(bounds.worldZMax),
  );
  const half = Math.min(256, Math.max(8, Math.ceil(xzExtent)));
  const yLevel = Math.round((bounds.worldYMin + bounds.worldYMax) / 2);
  return {
    rangeMin: -half,
    rangeMax: half,
    voxelYMin: bounds.worldYMin,
    voxelYMax: bounds.worldYMax,
    yLevel,
  };
}

/** Apply fit-to-content bounds with terrain surface guard (Base Y clipping). */
export function refineFitToContentApply(
  bounds: Bounds3DResult,
  nodes: Node[],
  edges: Edge[],
  contentFields: Record<string, number>,
  options?: { useBaseY?: boolean; anchorY?: number },
): FitToContentApply | null {
  const apply = fitToContentBoundsFromResult(bounds);
  if (!apply) return null;

  const useBaseY = options?.useBaseY ?? false;
  const anchorY = options?.anchorY ?? apply.yLevel;

  const terrainRefBase = resolveTerrainReferenceLevels(nodes, edges, contentFields, {
    useBaseY,
  });
  const terrainRefProfile = useBaseY
    ? resolveTerrainReferenceLevels(nodes, edges, contentFields, { useBaseY: false })
    : null;

  if (terrainRefBase) {
    const expandedA = expandVoxelYBoundsToIncludeSurface(
      apply.voxelYMin,
      apply.voxelYMax,
      terrainRefBase,
      { anchorY: anchorY ?? terrainRefBase.suggestedYLevel },
    );
    apply.voxelYMin = expandedA.worldYMin;
    apply.voxelYMax = expandedA.worldYMax;
  }
  if (terrainRefProfile) {
    const expandedB = expandVoxelYBoundsToIncludeSurface(
      apply.voxelYMin,
      apply.voxelYMax,
      terrainRefProfile,
      { anchorY: anchorY ?? terrainRefProfile.suggestedYLevel },
    );
    apply.voxelYMin = expandedB.worldYMin;
    apply.voxelYMax = expandedB.worldYMax;
  }
  return apply;
}

export interface RunFitToContentOptions {
  nodes: Node[];
  edges: Edge[];
  contentFields: Record<string, number>;
  outputNodeId?: string;
  selectedNodeId?: string;
  useBaseY?: boolean;
  materialConfig?: BiomeMaterialConfig | null;
  /** Probe window — defaults from graph analysis when omitted. */
  rangeMin?: number;
  rangeMax?: number;
  yMin?: number;
  yMax?: number;
  resolution?: number;
  /** Merge graph-derived terrain band so scans cannot clip below Base Y. */
  mergeTerrain?: boolean;
}

async function scanVolumeBoundsFromDensities(
  densities: Float32Array,
  resolution: number,
  ySlices: number,
  rangeMin: number,
  rangeMax: number,
  yMin: number,
  yMax: number,
): Promise<Bounds3DResult> {
  if (isTauriRuntime()) {
    const native = await scanVolumeSolidsBounds({
      densities,
      resolution,
      ySlices,
      rangeMin,
      rangeMax,
      yMin,
      yMax,
    });
    if (native) {
      return {
        worldXMin: native.worldXMin,
        worldXMax: native.worldXMax,
        worldYMin: native.worldYMin,
        worldYMax: native.worldYMax,
        worldZMin: native.worldZMin,
        worldZMax: native.worldZMax,
        hasSolids: native.hasSolids,
      };
    }
  }
  return scanDensityGrid3DBounds(
    densities,
    resolution,
    ySlices,
    rangeMin,
    rangeMax,
    yMin,
    yMax,
  );
}

/**
 * Runs a coarse volume probe to find where density solids exist, then returns
 * surface-aware XZ/Y bounds. Uses the graph-derived window when possible so
 * high Base-Y terrain is not missed.
 */
export async function runFitToContent(
  nodesOrOptions: Node[] | RunFitToContentOptions,
  edges?: Edge[],
  contentFields?: Record<string, number>,
  outputNodeId?: string,
  selectedNodeId?: string,
): Promise<Bounds3DResult | null> {
  const options: RunFitToContentOptions = Array.isArray(nodesOrOptions)
    ? {
        nodes: nodesOrOptions,
        edges: edges ?? [],
        contentFields: contentFields ?? {},
        outputNodeId,
        selectedNodeId,
      }
    : nodesOrOptions;

  const {
    nodes,
    edges: graphEdges,
    contentFields: fields,
    mergeTerrain = true,
    useBaseY = false,
    materialConfig,
  } = options;
  const rootNodeId = options.selectedNodeId ?? options.outputNodeId;

  const defaults = analyzeGraphDefaults(nodes, graphEdges, fields, {
    useBaseY,
    materialConfig,
    rootNodeId,
  });

  const rangeMin = options.rangeMin ?? defaults.suggestedRangeMin ?? -128;
  const rangeMax = options.rangeMax ?? defaults.suggestedRangeMax ?? 128;
  const yMin = options.yMin ?? defaults.suggestedYMin ?? 0;
  const yMax = options.yMax ?? defaults.suggestedYMax ?? DEFAULT_WORLD_HEIGHT;
  const resolution = options.resolution ?? 16;
  const ySpan = Math.max(16, yMax - yMin);
  const ySlices = Math.min(64, Math.max(16, Math.ceil(ySpan / 4)));

  const worker = createVolumeWorkerInstance();

  try {
    const result = await worker.evaluate({
      nodes,
      edges: graphEdges,
      resolution,
      rangeMin,
      rangeMax,
      yMin,
      yMax,
      ySlices,
      rootNodeId,
      options: {
        contentFields: enrichPreviewContentFields(fields, rangeMin, rangeMax),
      },
    });

    let bounds = await scanVolumeBoundsFromDensities(
      result.densities,
      result.resolution,
      result.ySlices,
      rangeMin,
      rangeMax,
      yMin,
      yMax,
    );

    if (mergeTerrain && bounds.hasSolids) {
      const terrain = computeTerrainAutoFitYBounds(nodes, graphEdges, fields, {
        rangeMin,
        rangeMax,
        rootNodeId,
        useBaseY,
        undergroundCarving: defaults.caveCarvingDetected,
      });
      if (terrain) {
        const mergedY = mergeScanWithTerrainAutoFit(
          {
            worldYMin: bounds.worldYMin,
            worldYMax: bounds.worldYMax,
            hasSolids: true,
          },
          terrain,
        );
        bounds = {
          ...bounds,
          worldYMin: mergedY.worldYMin,
          worldYMax: mergedY.worldYMax,
        };
      }
    }

    return bounds;
  } catch {
    return null;
  }
}

/**
 * Scans a density grid for the 3D bounding box of content, using surface-aware
 * Y logic (same as scanDensityGridYBounds) so terrain graphs don't get a Y min
 * pinned to bedrock.
 */
export function scanDensityGrid3DBounds(
  densities: Float32Array,
  resolution: number,
  ySlices: number,
  rangeMin: number,
  rangeMax: number,
  yMin: number,
  yMax: number,
): Bounds3DResult {
  const n = resolution;
  const totalPerSlice = n * n;

  // Track XZ bounds + per-slice solid counts in one pass
  let minXi = n, maxXi = -1;
  let minZi = n, maxZi = -1;
  const solidCounts = new Uint32Array(ySlices);

  for (let yi = 0; yi < ySlices; yi++) {
    const yBase = yi * n * n;
    let count = 0;
    for (let zi = 0; zi < n; zi++) {
      const rowBase = yBase + zi * n;
      for (let xi = 0; xi < n; xi++) {
        if (densities[rowBase + xi] >= 0) {
          count++;
          if (xi < minXi) minXi = xi;
          if (xi > maxXi) maxXi = xi;
          if (zi < minZi) minZi = zi;
          if (zi > maxZi) maxZi = zi;
        }
      }
    }
    solidCounts[yi] = count;
  }

  if (maxXi < 0) {
    return {
      worldXMin: rangeMin, worldXMax: rangeMax,
      worldYMin: yMin, worldYMax: yMax,
      worldZMin: rangeMin, worldZMax: rangeMax,
      hasSolids: false,
    };
  }

  // Surface-aware Y bounds (same logic as scanDensityGridYBounds)
  let firstSolid = -1;
  let lastSolid = -1;
  for (let yi = 0; yi < ySlices; yi++) {
    if (solidCounts[yi] > 0) {
      if (firstSolid < 0) firstSolid = yi;
      lastSolid = yi;
    }
  }

  let surfaceBottom = firstSolid;
  for (let yi = firstSolid; yi <= lastSolid; yi++) {
    if (solidCounts[yi] / totalPerSlice < UNDERGROUND_FRACTION) {
      surfaceBottom = Math.max(firstSolid, yi - 1);
      break;
    }
    surfaceBottom = yi;
  }

  const xzRange = rangeMax - rangeMin;
  const yRange = yMax - yMin;
  const toWorldXZ = (idx: number) => rangeMin + (idx / n) * xzRange;
  const toWorldY = (idx: number) => yMin + (idx / ySlices) * yRange;

  const xzPad = 8;
  const yPadBelow = 12;
  const yPadAbove = 10;

  return {
    worldXMin: Math.max(-256, Math.floor(toWorldXZ(minXi) - xzPad)),
    worldXMax: Math.min(256, Math.ceil(toWorldXZ(maxXi + 1) + xzPad)),
    worldYMin: Math.max(0, Math.floor(toWorldY(surfaceBottom) - yPadBelow)),
    worldYMax: Math.min(DEFAULT_WORLD_HEIGHT, Math.ceil(toWorldY(lastSolid + 1) + yPadAbove)),
    worldZMin: Math.max(-256, Math.floor(toWorldXZ(minZi) - xzPad)),
    worldZMax: Math.min(256, Math.ceil(toWorldXZ(maxZi + 1) + xzPad)),
    hasSolids: true,
  };
}

// ---------------------------------------------------------------------------
// Feature 3: Graph-Aware Defaults — static analysis of node types
// ---------------------------------------------------------------------------

export type ConfidenceLevel = "high" | "medium" | "low";

export interface GraphDefaultsResult {
  suggestedYMin: number;
  suggestedYMax: number;
  suggestedYLevel?: number;
  suggestedRangeMin: number;
  suggestedRangeMax: number;
  /** Optional: terrain graphs can suggest higher voxel fidelity defaults. */
  suggestedVoxelResolution?: number;
  suggestedVoxelYSlices?: number;
  confidence: ConfidenceLevel;
  reason: string;
  caveCarvingDetected?: boolean;
  hydrographyDetected?: boolean;
  featureTags?: string[];
}

/**
 * Statically analyzes graph node types to suggest good Y bounds and XZ range
 * before evaluation starts.
 */
export function analyzeGraphDefaults(
  nodes: Node[],
  edges: Edge[],
  contentFields: Record<string, number>,
  options?: { useBaseY?: boolean; materialConfig?: BiomeMaterialConfig | null; rootNodeId?: string },
): GraphDefaultsResult {
  const features = analyzeGraphPreviewFeatures(
    nodes,
    edges,
    contentFields,
    options?.materialConfig,
  );
  const caveCarving = features.undergroundCarving;
  const belowPad = features.belowPad;
  const useBaseY = options?.useBaseY ?? false;
  const featureSuffix = features.tags.length > 0 ? `; ${features.tags.join(", ")}` : "";

  // Priority 1: BaseHeight terrain — probe surface crossings for tight Y band
  const terrainAutoFit = computeTerrainAutoFitYBounds(nodes, edges, contentFields, {
    caveCarving,
    undergroundCarving: caveCarving,
    belowPad,
    useBaseY,
    rootNodeId: options?.rootNodeId,
  });
  if (terrainAutoFit) {
    const yLevel = suggestPreviewYLevel(features, terrainAutoFit.yLevel, terrainAutoFit.yLevel);
    return {
      suggestedYMin: terrainAutoFit.worldYMin,
      suggestedYMax: terrainAutoFit.worldYMax,
      suggestedYLevel: yLevel,
      // Give enough XZ span to actually see hills (cell/warp terrain often reads "flat"
      // if you only frame a tiny patch).
      suggestedRangeMin: -128,
      suggestedRangeMax: 128,
      // Hill-friendly baseline fidelity (kept conservative for perf).
      suggestedVoxelResolution: 64,
      suggestedVoxelYSlices: 64,
      confidence: "high",
      reason: `${terrainAutoFit.reason}${featureSuffix}`,
      caveCarvingDetected: caveCarving,
      hydrographyDetected: features.hydrography,
      featureTags: features.tags,
    };
  }

  // Fallback when graph has ContentFields base but no BaseHeight node
  const terrainRef = resolveTerrainReferenceLevels(nodes, edges, contentFields, {
    belowPad,
    caveCarving,
    useBaseY,
  });
  if (terrainRef) {
    const yLevel = suggestPreviewYLevel(
      features,
      terrainRef.suggestedYLevel,
      terrainRef.suggestedYLevel,
    );
    return {
      suggestedYMin: terrainRef.suggestedYMin,
      suggestedYMax: terrainRef.suggestedYMax,
      suggestedYLevel: yLevel,
      suggestedRangeMin: -128,
      suggestedRangeMax: 128,
      suggestedVoxelResolution: 64,
      suggestedVoxelYSlices: 64,
      confidence: "high",
      reason: `${terrainRef.reason}${featureSuffix}`,
      caveCarvingDetected: caveCarving,
      hydrographyDetected: features.hydrography,
      featureTags: features.tags,
    };
  }

  // Priority 2: SDF shapes — read scale fields, center around origin
  for (const node of nodes) {
    const type = (node.data as Record<string, unknown>)?.type as string | undefined;
    if (type === "Ellipsoid" || type === "Cuboid" || type === "Cylinder") {
      const fields = (node.data as Record<string, unknown>)?.fields as Record<string, unknown> | undefined;
      const scale = (fields?.Scale ?? fields?.Radius ?? fields?.Size) as
        { x?: number; y?: number; z?: number } | undefined;
      const sx = Number(scale?.x ?? 1) || 1;
      const sy = Number(scale?.y ?? 1) || 1;
      const sz = Number(scale?.z ?? 1) || 1;

      let maxExtent = Math.max(sx, sy, sz);
      if (type === "Cylinder") {
        const height = Number(fields?.Height ?? 2);
        const radius = Number(fields?.Radius ?? 1) || 1;
        maxExtent = Math.max(height / 2, radius);
      }

      const range = Math.ceil(maxExtent * 1.5);
      return {
        suggestedYMin: Math.max(0, -range),
        suggestedYMax: Math.min(DEFAULT_WORLD_HEIGHT, range),
        suggestedRangeMin: -range,
        suggestedRangeMax: range,
        confidence: "high",
        reason: `SDF shape "${type}" extent ~${maxExtent}`,
      };
    }
  }

  // Priority 3: Y-dependent nodes
  for (const node of nodes) {
    const type = (node.data as Record<string, unknown>)?.type as string | undefined;
    if (type === "YGradient" || type === "GradientDensity" || type === "YValue") {
      const fields = (node.data as Record<string, unknown>)?.fields as Record<string, unknown> | undefined;
      const fromY = Number(fields?.FromY ?? 0);
      const toY = Number(fields?.ToY ?? DEFAULT_WORLD_HEIGHT);
      const pad = Math.max((toY - fromY) * 0.1, 8);
      return {
        suggestedYMin: Math.max(0, Math.floor(fromY - pad)),
        suggestedYMax: Math.min(DEFAULT_WORLD_HEIGHT, Math.ceil(toY + pad)),
        suggestedRangeMin: -64,
        suggestedRangeMax: 64,
        confidence: "medium",
        reason: `Y-dependent node "${type}" range ${fromY}-${toY}`,
      };
    }
  }

  // Priority 4: Noise frequency heuristic
  for (const node of nodes) {
    const type = (node.data as Record<string, unknown>)?.type as string | undefined;
    if (type?.includes("Noise")) {
      const fields = (node.data as Record<string, unknown>)?.fields as Record<string, unknown> | undefined;
      const scale = Number(fields?.Scale ?? 1);
      const freq = scale !== 0 ? 1 / scale : Number(fields?.Frequency ?? 0.01);
      if (freq > 0) {
        if (caveCarving) {
          const baseY = contentFields["Base"] ?? 100;
          const yLevel = suggestPreviewYLevel(features, baseY);
          return {
            suggestedYMin: Math.max(0, Math.floor(baseY - belowPad)),
            suggestedYMax: Math.min(DEFAULT_WORLD_HEIGHT, Math.ceil(baseY + 50)),
            suggestedYLevel: yLevel,
            suggestedRangeMin: -64,
            suggestedRangeMax: 64,
            confidence: "medium",
            reason: `Noise + underground carving; Base height = ${baseY}${featureSuffix}`,
            caveCarvingDetected: true,
            hydrographyDetected: features.hydrography,
            featureTags: features.tags,
          };
        }
        const range = Math.min(DEFAULT_WORLD_HEIGHT, Math.ceil(2 / freq));
        return {
          suggestedYMin: 0,
          suggestedYMax: Math.min(DEFAULT_WORLD_HEIGHT, range),
          suggestedRangeMin: Math.max(-256, -range),
          suggestedRangeMax: Math.min(DEFAULT_WORLD_HEIGHT, range),
          confidence: "medium",
          reason: `Noise scale ${scale} → range ~${range}`,
          caveCarvingDetected: false,
        };
      }
    }
  }

  // Priority 5: Fallback — use contentFields["Base"] as center
  const baseY = contentFields["Base"] ?? 100;
  const yLevel = suggestPreviewYLevel(features, baseY);
  return {
    suggestedYMin: Math.max(0, Math.floor(baseY - belowPad)),
    // Give terrain a bit more headroom by default (hills + plateaus).
    suggestedYMax: Math.min(DEFAULT_WORLD_HEIGHT, Math.ceil(baseY + 90)),
    suggestedYLevel: yLevel,
    suggestedRangeMin: -128,
    suggestedRangeMax: 128,
    confidence: "low",
    reason: caveCarving
      ? `Fallback: Base height = ${baseY}; underground carving${featureSuffix}`
      : `Fallback: Base height = ${baseY}${featureSuffix}`,
    caveCarvingDetected: caveCarving,
    hydrographyDetected: features.hydrography,
    featureTags: features.tags,
  };
}
