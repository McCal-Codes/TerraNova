import type { BiomeMaterialConfig } from "@/utils/materialResolver";

/** Density below this at the preview slice is treated as open air/fluid (not solid). */
export const HYDRO_DENSITY_THRESHOLD = -0.04;

export interface HydrographyContext {
  /** True when biome has a water fluid source and a resolvable surface height. */
  enabled: boolean;
  waterSurfaceY: number | null;
  fluidMaterial: string | null;
}

export interface HydrographySliceParams {
  yLevel: number;
  waterSurfaceY: number;
}

/** Hytale fills oceans/rivers with Fluid materials such as Water_Source (see shore/river biomes). */
export function isWaterFluidMaterial(material: string): boolean {
  const norm = material.trim();
  if (!norm) return false;
  const lower = norm.toLowerCase();
  if (lower === "empty") return false;
  if (lower.includes("lava")) return false;
  return lower.includes("water");
}

/**
 * Resolve world-space water surface Y from biome material + content fields.
 *
 * Shore/river biomes use SimpleHorizontal Empty with TopY 0 and TopBaseHeight "Water"
 * (surface at the WorldStructures `Water` decimal constant). Other biomes may use an
 * absolute TopY (e.g. 64) on the fluid SimpleHorizontal branch.
 */
export function resolveWaterSurfaceY(
  materialConfig: BiomeMaterialConfig | null,
  contentFields: Record<string, number>,
): number | null {
  if (!materialConfig?.fluidMaterial || !isWaterFluidMaterial(materialConfig.fluidMaterial)) {
    return null;
  }

  const waterField = contentFields.Water;
  const level = materialConfig.fluidLevel;

  if (level != null) {
    if (level === 0 && typeof waterField === "number") {
      return waterField;
    }
    return level;
  }

  if (typeof waterField === "number") {
    return waterField;
  }

  return null;
}

export function detectHydrographyContext(
  materialConfig: BiomeMaterialConfig | null,
  contentFields: Record<string, number>,
): HydrographyContext {
  const waterSurfaceY = resolveWaterSurfaceY(materialConfig, contentFields);
  const fluidMaterial = materialConfig?.fluidMaterial ?? null;
  const enabled =
    waterSurfaceY != null
    && fluidMaterial != null
    && isWaterFluidMaterial(fluidMaterial);

  return {
    enabled,
    waterSurfaceY: enabled ? waterSurfaceY : null,
    fluidMaterial: enabled ? fluidMaterial : null,
  };
}

/** Open volume at the preview slice that lies at or below the configured water surface. */
export function isHydrographyCellAtSlice(
  density: number,
  yLevel: number,
  waterSurfaceY: number,
): boolean {
  if (density >= HYDRO_DENSITY_THRESHOLD) return false;
  return yLevel <= waterSurfaceY;
}

export function hydrographySliceParams(
  context: HydrographyContext,
  yLevel: number,
): HydrographySliceParams | null {
  if (!context.enabled || context.waterSurfaceY == null) return null;
  return { yLevel, waterSurfaceY: context.waterSurfaceY };
}
