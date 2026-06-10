/** Manual 2D resolution slider cap (base at 1× visual zoom). */
export const MAX_2D_PREVIEW_RES = 64;

/** Max grid size when zoomed in via scroll (eval only). */
export const MAX_2D_ZOOM_PREVIEW_RES = 256;

/** Coarse passes before the 2D target (target is appended once). */
export const PREVIEW_2D_PROGRESSIVE_STEPS = [16, 32, 64, 128] as const;

/** 3D heightmap uses the same coarse→target ladder as 2D (no 32/64 mid-passes). */
export const PREVIEW_3D_PROGRESSIVE_STEPS = [16] as const;

export function clamp2dPreviewResolution(resolution: number): number {
  return Math.min(Math.max(16, resolution), MAX_2D_PREVIEW_RES);
}

/** Clamp eval grid size (allows zoom-driven resolution above the manual slider cap). */
export function clamp2dEvalResolution(resolution: number): number {
  return Math.min(Math.max(16, resolution), MAX_2D_ZOOM_PREVIEW_RES);
}

export function initial2dPreviewResolution(defaultPreviewRes: number): number {
  return clamp2dPreviewResolution(defaultPreviewRes);
}

/**
 * Grid resolution for 2D density eval from base slider value and visual zoom.
 * Zoom in → more samples; zoom out → fewer (min 16). Snapped to 16-block steps so
 * smooth scrolling does not re-eval on every wheel tick.
 */
export function resolve2dPreviewResolutionForZoom(
  baseResolution: number,
  visualScale: number,
): number {
  const base = clamp2dPreviewResolution(baseResolution);
  const scaled = base * Math.max(0.25, visualScale);
  const snapped = Math.round(scaled / 16) * 16;
  return clamp2dEvalResolution(snapped);
}

/** Full density eval ladder for one target (no duplicate final pass). */
export function buildDensityPreviewEvalSteps(
  mode: "2d" | "3d",
  targetResolution: number,
): number[] {
  const target = mode === "2d"
    ? clamp2dEvalResolution(targetResolution)
    : targetResolution;
  const coarseSteps = mode === "2d"
    ? PREVIEW_2D_PROGRESSIVE_STEPS
    : PREVIEW_3D_PROGRESSIVE_STEPS;
  const ladder: number[] = [...coarseSteps.filter((step) => step < target)];
  if (ladder.length === 0 || ladder[ladder.length - 1] !== target) {
    ladder.push(target);
  }
  return ladder;
}
