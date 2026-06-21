import type { PreviewMode } from "@/stores/previewStore";

/** Teaching graph case ids (gallery + snippets share these). */
export const DENSITY_BASICS_CASE_IDS = [
  "density-noise-2d",
  "density-noise-3d",
  "density-sum-2d",
  "density-sum-3d",
  "density-min-carve",
  "density-max-2d",
  "density-mul-2d",
  "density-pow-2d",
] as const;

export type DensityBasicsCaseId = (typeof DENSITY_BASICS_CASE_IDS)[number];

export function isDensityBasicsCaseId(id: string): id is DensityBasicsCaseId {
  return (DENSITY_BASICS_CASE_IDS as readonly string[]).includes(id);
}

export interface DensityBasicsCaseMeta {
  id: DensityBasicsCaseId;
  name: string;
  description: string;
  /** Snippet / placed-node local id for preview target after insert. */
  previewLocalId: string;
  defaultPreviewMode: PreviewMode;
  contentFields: Record<string, number>;
  yLevel: number;
  voxelYMin: number;
  voxelYMax: number;
}

export const DENSITY_BASICS_CASE_META: Record<DensityBasicsCaseId, DensityBasicsCaseMeta> = {
  "density-noise-2d": {
    id: "density-noise-2d",
    name: "Noise 2D",
    description: "SimplexNoise2D hills on X/Z — 2D heatmap shows the full pattern at any Y slice.",
    previewLocalId: "noise",
    defaultPreviewMode: "2d",
    contentFields: {},
    yLevel: 64,
    voxelYMin: 0,
    voxelYMax: 128,
  },
  "density-noise-3d": {
    id: "density-noise-3d",
    name: "Noise 3D",
    description: "SimplexNoise3D varies with Y — use Voxel or scrub Y level to see the volume.",
    previewLocalId: "noise",
    defaultPreviewMode: "voxel",
    contentFields: {},
    yLevel: 64,
    voxelYMin: 0,
    voxelYMax: 128,
  },
  "density-sum-2d": {
    id: "density-sum-2d",
    name: "Sum (height + 2D noise)",
    description: "BaseHeight + SimplexNoise2D — hills on a height anchor; scrub Y or use Voxel for vertical structure.",
    previewLocalId: "sum",
    defaultPreviewMode: "2d",
    contentFields: { Base: 64 },
    yLevel: 64,
    voxelYMin: 0,
    voxelYMax: 128,
  },
  "density-sum-3d": {
    id: "density-sum-3d",
    name: "Sum (height + 3D noise)",
    description: "BaseHeight + SimplexNoise3D — volumetric hills; preview Sum in Voxel mode.",
    previewLocalId: "sum",
    defaultPreviewMode: "voxel",
    contentFields: { Base: 64 },
    yLevel: 64,
    voxelYMin: 0,
    voxelYMax: 128,
  },
  "density-min-carve": {
    id: "density-min-carve",
    name: "Min carve (caves)",
    description: "Terrain + inverted SimplexNoise3D carved with Min — use Voxel + Cutaway to see voids.",
    previewLocalId: "min",
    defaultPreviewMode: "voxel",
    contentFields: { Base: 64 },
    yLevel: 64,
    voxelYMin: 0,
    voxelYMax: 128,
  },
  "density-max-2d": {
    id: "density-max-2d",
    name: "Max (two 2D noises)",
    description: "Max keeps the higher of two SimplexNoise2D layers — compare inputs in Compare layout.",
    previewLocalId: "max",
    defaultPreviewMode: "2d",
    contentFields: {},
    yLevel: 64,
    voxelYMin: 0,
    voxelYMax: 128,
  },
  "density-mul-2d": {
    id: "density-mul-2d",
    name: "Multiplier (noise × mask)",
    description: "SimplexNoise2D scaled by a Constant mask — amplitude shaping on X/Z.",
    previewLocalId: "mul",
    defaultPreviewMode: "2d",
    contentFields: {},
    yLevel: 64,
    voxelYMin: 0,
    voxelYMax: 128,
  },
  "density-pow-2d": {
    id: "density-pow-2d",
    name: "Pow (sharpen noise)",
    description: "Pow(Exponent 2) on SimplexNoise2D — sharpens peaks and flattens mid-range.",
    previewLocalId: "pow",
    defaultPreviewMode: "2d",
    contentFields: {},
    yLevel: 64,
    voxelYMin: 0,
    voxelYMax: 128,
  },
};
