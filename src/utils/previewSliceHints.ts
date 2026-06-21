import { densitySkipsInlinePreview } from "./densityNoInlinePreview";

/** Node types whose 2D preview is often uniform at a fixed Y slice (height-only fields). */
export const Y_SLICE_UNIFORM_TYPES = new Set([
  "BaseHeight",
  "YValue",
  "CoordinateY",
  "Constant",
  "Terrain",
  "HeightAboveSurface",
  "Zero",
  "One",
  "YGradient",
  "GradientDensity",
  "Inverter",
  "Negate",
  "Abs",
  "Floor",
  "Ceiling",
  "Clamp",
]);

export function isUniformDensitySlice(minValue: number, maxValue: number): boolean {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return false;
  return Math.abs(maxValue - minValue) < 1e-6;
}

/**
 * Contextual hint when the 2D heatmap is a flat field at the current Y slice.
 * Returns null when the grid varies horizontally or data is not ready.
 */
export function getUniformSlicePreviewHint(
  previewTargetType: string | null,
  minValue: number,
  maxValue: number,
  yLevel: number,
): string | null {
  if (densitySkipsInlinePreview(previewTargetType ?? "")) return null;
  if (!isUniformDensitySlice(minValue, maxValue)) return null;

  const type = previewTargetType ?? "";

  if (type === "BaseHeight") {
    return `Uniform at Y=${yLevel} — solid below the surface reference, air above. Use Distance: on with CurveMapper for shaped terrain, or add noise in Sum. Move Y slice or open Voxel / Vertical section.`;
  }

  if (type === "Sum" || type === "Product" || type === "Multiplier") {
    return `Uniform at Y=${yLevel} on this slice — confirm Preview target is ${type} (preview settings sidebar), not an upstream height-only node. Move Y slice or open Voxel / Vertical section for full-height variation.`;
  }

  if (type === "Pow") {
    return `Uniform at Y=${yLevel} on this slice — confirm Preview target is Pow, not upstream noise alone. Move Y slice or open Voxel / Vertical section.`;
  }

  if (!type || Y_SLICE_UNIFORM_TYPES.has(type)) {
    return `Uniform at Y=${yLevel} on this horizontal slice — normal for height-only density. Move the Y slice slider or use Voxel / Vertical section to see variation.`;
  }

  return `Density is uniform across X/Z at Y=${yLevel}. Move the Y slice slider or switch to Voxel / Vertical section.`;
}

/**
 * Contextual hint for material-column preview (stub/passthrough nodes vs full voxel verify).
 */
export function getMaterialPreviewContextHint(usesPassthroughStubNodes: boolean): string {
  if (usesPassthroughStubNodes) {
    return "This stack includes passthrough material nodes (Surface, Exported, etc.) that the column preview approximates. Switch to Voxel preview on Terrain to verify the full stack.";
  }
  return "Materials apply only to solid voxels. Verify full stacks in Voxel preview on Terrain.";
}
