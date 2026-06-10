import type { Edge, Node } from "@xyflow/react";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { hytaleToInternalBiome } from "@/utils/hytaleToInternal";
import { getNodeType } from "@/utils/density/evalTypes";
import { extractMaterialConfig } from "@/utils/materialResolver";
import type { BiomeMaterialConfig } from "@/utils/materialResolver";
import underworldBiome from "../../templates/references/TheUnderworld.json";
import tropicalBiome from "../../templates/references/Tropical_Pirate_Islands.json";
import {
  buildMudcracksCubeGraph,
  buildSdfShowcaseGraph,
  SDF_GALLERY_VOXEL_Y,
  SDF_SHOWCASE_TYPES,
} from "./shapePreviewSdfShowcase";

/** DEV shape-preview gallery cases (reference biomes + SDF showcase). */
export type GalleryCase =
  | "underworld-cell"
  | "underworld-max"
  | "tropical-pcn"
  | "sdf-showcase"
  | "mudcracks-cube";

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
  materialConfig: BiomeMaterialConfig | null;
  voxelYMin: number;
  voxelYMax: number;
  /** TheUnderworld-max: alternate CellNoise2D preview targets */
  mixAltNodeIds?: string[];
}

const UNDERWORLD_REF = "templates/references/TheUnderworld.json";
const TROPICAL_REF = "templates/references/Tropical_Pirate_Islands.json";
const MUDCRACKS_REF = "templates/references/Mudcracks_Actual_WIP_11.json";
const SDF_SHOWCASE_REF = "dev/shape-preview-sdf-showcase";

/** Default ContentFields.Base for reference biomes that use BaseHeightName "Base". */
export const GALLERY_CONTENT_FIELDS: Record<string, number> = { Base: 0 };

function terrainGraphFromBiome(biome: Record<string, unknown>) {
  const { wrapper } = hytaleToInternalBiome(biome);
  const terrain = wrapper.Terrain as Record<string, unknown> | undefined;
  if (!terrain?.Density || typeof terrain.Density !== "object") {
    throw new Error("Reference biome missing Terrain.Density");
  }
  const { nodes, edges } = jsonToGraph(
    terrain.Density as Record<string, unknown>,
    0,
    0,
    "terrain",
  );
  const outputNodeId = nodes.length > 0 ? nodes[nodes.length - 1]!.id : null;
  return {
    nodes,
    edges,
    outputNodeId,
    materialConfig: extractMaterialConfig(wrapper),
  };
}

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

export function getGalleryCaseSetup(caseId: GalleryCase): GalleryCaseSetup {
  switch (caseId) {
    case "underworld-cell": {
      const { nodes, edges, outputNodeId, materialConfig } = terrainGraphFromBiome(
        underworldBiome as Record<string, unknown>,
      );
      const cells = findAll(nodes, "CellNoise2D");
      const fine =
        cells.find((n) => cellNoiseFrequency(n) === 0.05) ??
        cells.find((n) => cellNoiseFrequency(n) === 1 / 20) ??
        cells[0] ??
        null;
      return {
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
      };
    }
    case "underworld-max": {
      const { nodes, edges, outputNodeId, materialConfig } = terrainGraphFromBiome(
        underworldBiome as Record<string, unknown>,
      );
      const maxNode = findFirst(nodes, "Max");
      const cells = findAll(nodes, "CellNoise2D");
      const fine = cells.find((n) => cellNoiseFrequency(n) === 0.05);
      const coarse = cells.find((n) => cellNoiseFrequency(n) === 0.01);
      const altIds = [fine?.id, coarse?.id].filter((id): id is string => !!id);
      return {
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
      };
    }
    case "tropical-pcn": {
      const { nodes, edges, outputNodeId, materialConfig } = terrainGraphFromBiome(
        tropicalBiome as Record<string, unknown>,
      );
      const pcn = findFirst(nodes, "PositionsCellNoise");
      return {
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
      };
    }
    case "sdf-showcase": {
      const { nodes, edges, shapeNodeIds, defaultShape } = buildSdfShowcaseGraph();
      const defaultId = shapeNodeIds[defaultShape];
      const altIds = SDF_SHOWCASE_TYPES.map((t) => shapeNodeIds[t]).filter(
        (id) => id !== defaultId,
      );
      return {
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
      };
    }
    case "mudcracks-cube": {
      const { nodes, edges, cubeNodeId } = buildMudcracksCubeGraph();
      return {
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
      };
    }
    default:
      return getGalleryCaseSetup("underworld-cell");
  }
}

export const GALLERY_CASES: GalleryCase[] = [
  "underworld-cell",
  "underworld-max",
  "tropical-pcn",
  "sdf-showcase",
  "mudcracks-cube",
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
