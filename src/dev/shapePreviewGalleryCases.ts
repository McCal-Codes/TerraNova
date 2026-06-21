import type { Edge, Node } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";
import type { BiomeMaterialConfig } from "@/utils/materialResolver";
import type { DensityExportMap } from "@/utils/densityExportRegistry";
import { resolveShapePreviewTarget } from "@/utils/shapePreview/resolveShapePreviewTarget";
import type { PreviewMode } from "@/stores/previewStore";
import { biomeGraphFromBiome } from "@/utils/biomePreviewGraph";
export { biomeGraphFromBiome, terrainGraphFromBiome } from "@/utils/biomePreviewGraph";
import underworldBiome from "../../templates/references/TheUnderworld.json";
import tropicalBiome from "../../templates/references/Tropical_Pirate_Islands.json";
import {
  HYTALE_SMOKE_BIOMES,
  type HytaleGallerySmokeBiomeId,
} from "./hytalePreviewSmokePaths";
import {
  TEST_FEATURES_Y_LEVEL,
  getTestFeaturesPatchPreset,
  parseTestFeaturesPatchIndex,
  resolveTestFeaturesPatches,
  type ResolvedTestFeaturesPatch,
} from "./testFeaturesGalleryPatches";
import {
  buildMudcracksCubeGraph,
  buildSdfShowcaseGraph,
  SDF_GALLERY_VOXEL_Y,
  SDF_SHOWCASE_TYPES,
} from "./shapePreviewSdfShowcase";
import {
  buildDensityBasicsCase,
} from "@/utils/densityBasics/showcase";
import {
  DENSITY_BASICS_CASE_IDS,
  isDensityBasicsCaseId,
  type DensityBasicsCaseId,
} from "@/utils/densityBasics/caseMeta";

const DENSITY_BASICS_REF = "dev/density-basics-showcase";

/** DEV shape-preview gallery cases (reference biomes + SDF showcase). */
export type GalleryCase =
  | "underworld-cell"
  | "underworld-max"
  | "tropical-pcn"
  | "sdf-showcase"
  | "mudcracks-cube"
  | "hytale-plains1-river"
  | "hytale-plains1-deeproot"
  | "hytale-example-cellnoise2d"
  | "hytale-generative-arches"
  | "hytale-generative-veins"
  | "hytale-test-features"
  | DensityBasicsCaseId;

export const DENSITY_BASICS_GALLERY_CASES: DensityBasicsCaseId[] = [...DENSITY_BASICS_CASE_IDS];

export const HYTALE_GALLERY_CASES: GalleryCase[] = [
  "hytale-example-cellnoise2d",
  "hytale-generative-arches",
  "hytale-generative-veins",
  "hytale-plains1-river",
  "hytale-plains1-deeproot",
  "hytale-test-features",
];

export type HytaleGalleryCaseId = Extract<GalleryCase, `hytale-${string}`>;

export const HYTALE_GALLERY_BIOME_PATHS: Record<HytaleGalleryCaseId, string> = {
  "hytale-example-cellnoise2d": HYTALE_SMOKE_BIOMES.exampleCellNoise2D,
  "hytale-generative-arches": HYTALE_SMOKE_BIOMES.generativeArches,
  "hytale-generative-veins": HYTALE_SMOKE_BIOMES.generativeVeins,
  "hytale-plains1-river": HYTALE_SMOKE_BIOMES.plains1River,
  "hytale-plains1-deeproot": HYTALE_SMOKE_BIOMES.plains1Deeproot,
  "hytale-test-features": HYTALE_SMOKE_BIOMES.testFeatures,
};

export function isHytaleGalleryCase(caseId: GalleryCase): boolean {
  return caseId.startsWith("hytale-");
}

export function hytaleGalleryCaseIdFromBiomeId(id: HytaleGallerySmokeBiomeId): GalleryCase {
  switch (id) {
    case "exampleCellNoise2D":
      return "hytale-example-cellnoise2d";
    case "generativeArches":
      return "hytale-generative-arches";
    case "generativeVeins":
      return "hytale-generative-veins";
    case "plains1River":
      return "hytale-plains1-river";
    case "plains1Deeproot":
      return "hytale-plains1-deeproot";
    case "testFeatures":
      return "hytale-test-features";
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export interface GalleryCaseSetup {
  id: GalleryCase;
  /** Human label including source file */
  label: string;
  /** Repo-relative path to the Hytale reference JSON */
  referencePath: string;
  nodes: Node[];
  edges: Edge[];
  outputNodeId: string | null;
  previewNodeId: string | null;
  preset: "pcn" | "pcnMesh" | "sdf";
  yLevel: number;
  /** ContentFields for BaseHeight / terrain reference (density basics cases). */
  contentFields?: Record<string, number>;
  materialConfig: BiomeMaterialConfig | null;
  voxelYMin: number;
  voxelYMax: number;
  /** When false, harness defaults to voxel-first (hydro / cave smoke). */
  shapePreviewEnabled: boolean;
  defaultPreviewMode: PreviewMode;
  materialNodes: Node[];
  materialEdges: Edge[];
  externalDensityExports: DensityExportMap;
  /** TheUnderworld-max: alternate CellNoise2D preview targets */
  mixAltNodeIds?: string[];
  /** Test_Features: resolved patch catalog with graph node ids */
  testFeaturesPatches?: ResolvedTestFeaturesPatch[];
  /** Test_Features: 1-based patch index; null = Max (all patches) */
  testFeaturesPatchIndex?: number | null;
}

const UNDERWORLD_REF = "templates/references/TheUnderworld.json";
const TROPICAL_REF = "templates/references/Tropical_Pirate_Islands.json";
const MUDCRACKS_REF = "templates/references/Mudcracks_Actual_WIP_11.json";
const SDF_SHOWCASE_REF = "dev/shape-preview-sdf-showcase";

/** Default ContentFields.Base for reference biomes that use BaseHeightName "Base". */
export const GALLERY_CONTENT_FIELDS: Record<string, number> = { Base: 0 };

function findFirst(nodes: Node[], type: string) {
  return nodes.find((n) => getNodeType(n) === type) ?? null;
}

function findAll(nodes: Node[], type: string) {
  return nodes.filter((n) => getNodeType(n) === type);
}

/** After hytale import, CellNoise2D uses Frequency (= 1/ScaleX) instead of ScaleX. */
function cellNoiseFrequency(node: Node): number | undefined {
  const fields = (node.data as Record<string, unknown>).fields as Record<string, unknown> | undefined;
  if (typeof fields?.Frequency === "number") return fields.Frequency;
  const scaleX = fields?.ScaleX;
  if (typeof scaleX === "number" && scaleX !== 0) return 1 / scaleX;
  return undefined;
}

function finalizeGallerySetup(
  setup: Omit<
    GalleryCaseSetup,
    "shapePreviewEnabled" | "defaultPreviewMode" | "materialNodes" | "materialEdges" | "externalDensityExports"
  > &
    Partial<
      Pick<
        GalleryCaseSetup,
        | "shapePreviewEnabled"
        | "defaultPreviewMode"
        | "materialNodes"
        | "materialEdges"
        | "externalDensityExports"
      >
    >,
): GalleryCaseSetup {
  return {
    shapePreviewEnabled: setup.shapePreviewEnabled ?? true,
    defaultPreviewMode: setup.defaultPreviewMode ?? "2d",
    materialNodes: [],
    materialEdges: [],
    externalDensityExports: {},
    ...setup,
  };
}

function bundledBiomeGraph(biome: Record<string, unknown>) {
  return biomeGraphFromBiome(biome);
}

function densityBasicsGallerySetup(caseId: DensityBasicsCaseId): GalleryCaseSetup {
  const graph = buildDensityBasicsCase(caseId);
  const shapePreview =
    caseId === "density-max-2d" || caseId === "density-min-carve";
  return finalizeGallerySetup({
    id: caseId,
    label: `Density basics — ${caseId.replace(/^density-/, "").replace(/-/g, " ")}`,
    referencePath: DENSITY_BASICS_REF,
    nodes: graph.nodes,
    edges: graph.edges,
    outputNodeId: graph.outputNodeId,
    previewNodeId: graph.previewNodeId,
    preset: "pcn",
    yLevel: graph.yLevel,
    contentFields: graph.contentFields,
    materialConfig: null,
    voxelYMin: graph.voxelYMin,
    voxelYMax: graph.voxelYMax,
    shapePreviewEnabled: shapePreview,
    defaultPreviewMode: graph.defaultPreviewMode,
    mixAltNodeIds: graph.mixAltNodeIds,
  });
}

export function getGalleryCaseSetup(caseId: GalleryCase): GalleryCaseSetup {
  if (isDensityBasicsCaseId(caseId)) {
    return densityBasicsGallerySetup(caseId);
  }
  switch (caseId) {
    case "underworld-cell": {
      const graph = bundledBiomeGraph(underworldBiome as Record<string, unknown>);
      const { nodes, edges, outputNodeId, materialConfig } = graph;
      const cells = findAll(nodes, "CellNoise2D");
      const fine =
        cells.find((n) => cellNoiseFrequency(n) === 0.05) ??
        cells.find((n) => cellNoiseFrequency(n) === 1 / 20) ??
        cells[0] ??
        null;
      return finalizeGallerySetup({
        id: "underworld-cell",
        label: "TheUnderworld — CellNoise2D (fine cells, Frequency 0.05)",
        referencePath: UNDERWORLD_REF,
        nodes,
        edges,
        outputNodeId,
        previewNodeId: fine?.id ?? null,
        preset: "pcn",
        yLevel: 64,
        materialConfig,
        voxelYMin: 0,
        voxelYMax: 120,
        materialNodes: graph.materialNodes,
        materialEdges: graph.materialEdges,
      });
    }
    case "underworld-max": {
      const graph = bundledBiomeGraph(underworldBiome as Record<string, unknown>);
      const { nodes, edges, outputNodeId, materialConfig } = graph;
      const maxNode = findFirst(nodes, "Max");
      const cells = findAll(nodes, "CellNoise2D");
      const fine = cells.find((n) => cellNoiseFrequency(n) === 0.05);
      const coarse = cells.find((n) => cellNoiseFrequency(n) === 0.01);
      const altIds = [fine?.id, coarse?.id].filter((id): id is string => !!id);
      return finalizeGallerySetup({
        id: "underworld-max",
        label: "TheUnderworld — Max (terrain output)",
        referencePath: UNDERWORLD_REF,
        nodes,
        edges,
        outputNodeId: maxNode?.id ?? outputNodeId,
        previewNodeId: maxNode?.id ?? outputNodeId,
        preset: "pcn",
        yLevel: 64,
        materialConfig,
        voxelYMin: 0,
        voxelYMax: 120,
        mixAltNodeIds: altIds,
        materialNodes: graph.materialNodes,
        materialEdges: graph.materialEdges,
      });
    }
    case "tropical-pcn": {
      const graph = bundledBiomeGraph(tropicalBiome as Record<string, unknown>);
      const { nodes, edges, outputNodeId, materialConfig } = graph;
      const pcn = findFirst(nodes, "PositionsCellNoise");
      return finalizeGallerySetup({
        id: "tropical-pcn",
        label: "Tropical_Pirate_Islands — PositionsCellNoise",
        referencePath: TROPICAL_REF,
        nodes,
        edges,
        outputNodeId,
        previewNodeId: pcn?.id ?? null,
        preset: "pcnMesh",
        yLevel: 0,
        materialConfig,
        voxelYMin: 0,
        voxelYMax: 128,
        materialNodes: graph.materialNodes,
        materialEdges: graph.materialEdges,
      });
    }
    case "sdf-showcase": {
      const { nodes, edges, shapeNodeIds, defaultShape } = buildSdfShowcaseGraph();
      const defaultId = shapeNodeIds[defaultShape];
      const altIds = SDF_SHOWCASE_TYPES.map((t) => shapeNodeIds[t]).filter(
        (id) => id !== defaultId,
      );
      return finalizeGallerySetup({
        id: "sdf-showcase",
        label: "SDF showcase — Ellipsoid, Cuboid, Cylinder, Plane, Shell, Cube",
        referencePath: SDF_SHOWCASE_REF,
        nodes,
        edges,
        outputNodeId: defaultId,
        previewNodeId: defaultId,
        preset: "sdf",
        yLevel: 0,
        materialConfig: null,
        voxelYMin: SDF_GALLERY_VOXEL_Y.min,
        voxelYMax: SDF_GALLERY_VOXEL_Y.max,
        mixAltNodeIds: altIds,
      });
    }
    case "mudcracks-cube": {
      const { nodes, edges, cubeNodeId } = buildMudcracksCubeGraph();
      return finalizeGallerySetup({
        id: "mudcracks-cube",
        label: "Mudcracks_Actual_WIP_11 — Cube SDF (reference curve)",
        referencePath: MUDCRACKS_REF,
        nodes,
        edges,
        outputNodeId: cubeNodeId,
        previewNodeId: cubeNodeId,
        preset: "sdf",
        yLevel: 0,
        materialConfig: null,
        voxelYMin: SDF_GALLERY_VOXEL_Y.min,
        voxelYMax: SDF_GALLERY_VOXEL_Y.max,
      });
    }
    default: {
      if (isHytaleGalleryCase(caseId)) {
        throw new Error(
          `Hytale gallery case "${caseId}" must be loaded via fetch + getHytaleGalleryCaseSetup`,
        );
      }
      return getGalleryCaseSetup("underworld-cell");
    }
  }
}

/** Build gallery setup from a fetched Hytale release biome JSON (dev / smoke harness). */
export function getHytaleGalleryCaseSetup(
  caseId: HytaleGalleryCaseId,
  biome: Record<string, unknown>,
  externalDensityExports: DensityExportMap = {},
  search = "",
): GalleryCaseSetup {
  if (caseId === "hytale-test-features") {
    return getTestFeaturesGalleryCaseSetup(biome, externalDensityExports, search);
  }

  const graph = biomeGraphFromBiome(biome);
  const referencePath = HYTALE_GALLERY_BIOME_PATHS[caseId];
  const preferShapePreview =
    caseId !== "hytale-plains1-river" && caseId !== "hytale-plains1-deeproot";
  const shape = resolveShapePreviewTarget(graph.nodes, graph.edges, {
    externalDensityExports,
    preferShapePreview,
  });

  const labels: Record<Exclude<HytaleGalleryCaseId, "hytale-test-features">, string> = {
    "hytale-example-cellnoise2d":
      "Example_CellNoise2D (release) — CellNoise2D cell walls on BaseHeight stack",
    "hytale-generative-arches":
      "Generative_Arches (release) — PositionsCellNoise + Mesh2D",
    "hytale-generative-veins":
      "Generative_Veins (release) — PositionsCellNoise carved terrain",
    "hytale-plains1-river": "Plains1_River (release) — terrain + hydrography",
    "hytale-plains1-deeproot":
      "Plains1_Deeproot (release) — caves + imported Plains1_Caves_Deeproot_Terrain",
  };

  return {
    id: caseId,
    label: labels[caseId],
    referencePath,
    nodes: graph.nodes,
    edges: graph.edges,
    outputNodeId: shape.outputNodeId ?? graph.outputNodeId,
    previewNodeId: shape.previewNodeId,
    preset: shape.preset,
    yLevel: 64,
    materialConfig: graph.materialConfig,
    voxelYMin: 0,
    voxelYMax: 256,
    shapePreviewEnabled: shape.shapePreviewEnabled,
    defaultPreviewMode: shape.defaultPreviewMode,
    materialNodes: graph.materialNodes,
    materialEdges: graph.materialEdges,
    externalDensityExports,
  };
}

export function getTestFeaturesGalleryCaseSetup(
  biome: Record<string, unknown>,
  externalDensityExports: DensityExportMap = {},
  search = "",
): GalleryCaseSetup {
  const graph = biomeGraphFromBiome(biome);
  const patches = resolveTestFeaturesPatches(graph.nodes, graph.edges);
  const maxNode = graph.nodes.find((n) => getNodeType(n) === "Max");
  const patchIndex = parseTestFeaturesPatchIndex(search);
  const viewAll = patchIndex == null;
  const selected = viewAll ? null : patches.find((p) => p.index === patchIndex) ?? patches[0] ?? null;
  const previewNodeId = viewAll ? (maxNode?.id ?? graph.outputNodeId) : (selected?.nodeId ?? maxNode?.id ?? null);
  const preset = selected ? getTestFeaturesPatchPreset(selected.category) : "pcn";

  return {
    id: "hytale-test-features",
    label: viewAll
      ? "Test_Features (release) — Max gallery (56 patches)"
      : `Test_Features — patch ${selected?.index ?? "?"}: ${selected?.label ?? "unknown"}`,
    referencePath: HYTALE_GALLERY_BIOME_PATHS["hytale-test-features"],
    nodes: graph.nodes,
    edges: graph.edges,
    outputNodeId: maxNode?.id ?? graph.outputNodeId,
    previewNodeId,
    preset,
    yLevel: TEST_FEATURES_Y_LEVEL,
    materialConfig: graph.materialConfig,
    voxelYMin: 80,
    voxelYMax: 120,
    shapePreviewEnabled: true,
    defaultPreviewMode: preset === "sdf" ? "voxel" : "2d",
    materialNodes: graph.materialNodes,
    materialEdges: graph.materialEdges,
    externalDensityExports,
    mixAltNodeIds: patches.map((p) => p.nodeId),
    testFeaturesPatches: patches,
    testFeaturesPatchIndex: viewAll ? null : (selected?.index ?? null),
  };
}

/** Bundled reference biomes + SDF showcase (no synced Hytale cache required). */
export const BUNDLED_GALLERY_CASES: GalleryCase[] = [
  "underworld-cell",
  "underworld-max",
  "tropical-pcn",
  "sdf-showcase",
  "mudcracks-cube",
  ...DENSITY_BASICS_GALLERY_CASES,
];

export const GALLERY_CASES: GalleryCase[] = [
  ...BUNDLED_GALLERY_CASES,
  ...HYTALE_GALLERY_CASES,
];

const LEGACY_CASE_ALIASES: Record<string, GalleryCase> = {
  pcn: "underworld-cell",
  mix: "underworld-max",
  sdf: "sdf-showcase",
  cube: "mudcracks-cube",
};

export function parseGalleryCase(search: string): GalleryCase {
  const raw = new URLSearchParams(search).get("case") ?? "underworld-cell";
  if (GALLERY_CASES.includes(raw as GalleryCase)) return raw as GalleryCase;
  if (raw in LEGACY_CASE_ALIASES) return LEGACY_CASE_ALIASES[raw]!;
  return "underworld-cell";
}
