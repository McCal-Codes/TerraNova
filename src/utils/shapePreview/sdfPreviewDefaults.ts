/** Origin-centered Shape SDF nodes need symmetric voxel Y around world Y=0. */
export const SDF_DEFAULT_VOXEL_Y = { min: -32, max: 32, slices: 64 } as const;

export function isLikelyOriginCenteredSdfVoxelRange(yMin: number, yMax: number): boolean {
  return yMin >= 0 && yMax > 0 && yMin + 32 < yMax;
}
