/**
 * Density nodes that should not show inline heatmap thumbnails.
 * Remappers and passthroughs — inspect the curve editor or preview downstream (e.g. Terrain Out).
 */
export const DENSITY_NO_INLINE_PREVIEW_TYPES = new Set([
  "CurveMapper",
  "CurveFunction",
  "SplineFunction",
  "Passthrough",
  "Wrap",
  "Debug",
  "FlatCache",
  "Cache",
  "CacheOnce",
  "Cache2D",
]);

export function densitySkipsInlinePreview(nodeType: string): boolean {
  return DENSITY_NO_INLINE_PREVIEW_TYPES.has(nodeType);
}

/** Heatmap preview is not meaningful for these remappers — guide users to the curve editor / downstream output. */
export function getPreviewTargetGuidance(previewTargetType: string | null): string | null {
  if (!previewTargetType) return null;
  if (previewTargetType === "Manual" || previewTargetType.startsWith("Curve:")) {
    return "Curve assets remap numbers — they are not terrain density. Select Sum or Terrain Out for voxel preview.";
  }
  if (previewTargetType === "CurveMapper" || previewTargetType === "CurveFunction") {
    return "CurveMapper remaps Input through a curve — this heatmap is not the right view. Edit the connected Curve:Manual node and preview from Terrain Out or Sum.";
  }
  if (previewTargetType === "SplineFunction") {
    return "SplineFunction remaps Input through control points — preview from Terrain Out or Sum, not this node alone.";
  }
  return null;
}
