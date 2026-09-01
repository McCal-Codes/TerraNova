import { Plane, Vector3 } from "three";
import { worldToVoxelScenePoint, type VoxelSceneMapping } from "@/utils/shapePreview/previewSceneCoords";
import type { CutawayVolume } from "@/utils/voxelExtractor";

/**
 * How the preview volume is cut open.
 *
 *   off    — no cut.
 *   top    — remove everything above the cut level. Cheap enough to preview with a
 *            single GPU clip plane while dragging.
 *   corner — remove one horizontal quadrant above the cut level, leaving an L-shaped
 *            remainder. This is the section view that keeps surface context visible
 *            while exposing the interior.
 */
export type CutawayPreset = "off" | "top" | "corner";

export const CUTAWAY_PRESETS: readonly CutawayPreset[] = ["off", "top", "corner"] as const;

export function isCutawayPreset(value: unknown): value is CutawayPreset {
  return typeof value === "string" && (CUTAWAY_PRESETS as readonly string[]).includes(value);
}

/** Build a Y-axis clip plane that hides geometry above `cutawayWorldY` in voxel scene space. */
export function buildCutawayClipPlane(
  cutawayWorldY: number,
  map: VoxelSceneMapping,
): Plane {
  const [, sceneY] = worldToVoxelScenePoint(0, cutawayWorldY, 0, map);
  // normal (0, -1, 0): discard fragments where -y + constant < 0  =>  y > constant
  return new Plane(new Vector3(0, -1, 0), sceneY);
}

/**
 * Only the "top" preset gets a live clip-plane preview.
 *
 * Removing a corner is the intersection of three half-spaces, which in three.js means
 * `clipIntersection: true` — and that makes the renderer reinitialise materials every
 * frame, costing a large amount of FPS. The corner preset therefore skips the GPU
 * preview and relies on re-extraction, which produces better geometry anyway: a clip
 * plane leaves the cut hollow, re-extraction caps it with solid rock.
 */
export function presetSupportsClipPlanePreview(preset: CutawayPreset): boolean {
  return preset === "top";
}

export interface VoxelVolumeDims {
  resolution: number;
  ySlices: number;
  voxelYMin: number;
  voxelYMax: number;
}

/**
 * Convert a world Y to a voxel slice index.
 *
 * Matches the convention already used for the fluid level in finishVoxelFromVolume:
 * `round((worldY - voxelYMin) / (voxelYMax - voxelYMin) * ySlices)`.
 */
export function worldYToSlice(worldY: number, dims: VoxelVolumeDims): number {
  const range = dims.voxelYMax - dims.voxelYMin;
  if (range <= 0) return 0;
  const slice = Math.round(((worldY - dims.voxelYMin) / range) * dims.ySlices);
  return Math.max(0, Math.min(dims.ySlices, slice));
}

/**
 * Derive the extraction cutaway for a preset.
 *
 * Returns undefined for "off" so callers can skip re-extraction entirely and keep the
 * default whole-volume geometry.
 */
export function buildCutawayVolume(
  preset: CutawayPreset,
  cutawayWorldY: number,
  dims: VoxelVolumeDims,
): CutawayVolume | undefined {
  if (preset === "off") return undefined;

  const n = dims.resolution;
  const cutSlice = worldYToSlice(cutawayWorldY, dims);

  if (preset === "top") {
    // Keep everything below the cut. The keep-box edge caps the exposed face.
    return { keep: { x0: 0, x1: n, y0: 0, y1: cutSlice, z0: 0, z1: n } };
  }

  // corner: remove one quadrant, but only above the cut level, so the ground below the
  // cut stays intact and you look down into a notch rather than through the whole model.
  const halfX = Math.floor(n / 2);
  const halfZ = Math.floor(n / 2);
  return {
    remove: {
      x0: halfX,
      x1: n,
      y0: cutSlice,
      y1: dims.ySlices,
      z0: halfZ,
      z1: n,
    },
  };
}
