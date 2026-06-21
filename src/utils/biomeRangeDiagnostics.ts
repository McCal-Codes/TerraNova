import type { BiomeRangeEntry, NoiseRangeConfig } from "@/stores/slices/types";
import type { GraphDiagnostic } from "@/utils/graphDiagnostics";
import { validateBiomeRanges } from "@/utils/biomeRangeDomain";

export interface AnalyzeNoiseRangeInput {
  biomeRanges: BiomeRangeEntry[];
  noiseRangeConfig: NoiseRangeConfig | null;
  projectBiomeNames?: string[];
}

export function analyzeNoiseRange(input: AnalyzeNoiseRangeInput): GraphDiagnostic[] {
  const { biomeRanges, noiseRangeConfig, projectBiomeNames } = input;
  const diags: GraphDiagnostic[] = [];
  const validation = validateBiomeRanges(biomeRanges, noiseRangeConfig, { projectBiomeNames });

  if (biomeRanges.length === 0) {
    diags.push({
      nodeId: null,
      message: "World structure has no biome ranges — add at least one Biome entry",
      severity: "error",
      biomeSection: "BiomeRanges",
      code: "biome-range-empty",
    });
    if (!noiseRangeConfig?.DefaultBiome?.trim()) {
      diags.push({
        nodeId: null,
        message: "DefaultBiome is required as fallback when no range matches",
        severity: "error",
        biomeSection: "BiomeRanges",
        code: "biome-range-default-missing",
        field: "DefaultBiome",
      });
    }
    return diags;
  }

  if (!noiseRangeConfig?.DefaultBiome?.trim()) {
    diags.push({
      nodeId: null,
      message: "DefaultBiome is required as fallback when no range matches",
      severity: "error",
      biomeSection: "BiomeRanges",
      code: "biome-range-default-missing",
      field: "DefaultBiome",
    });
  } else if (validation.defaultNotListed) {
    diags.push({
      nodeId: null,
      message: `DefaultBiome "${noiseRangeConfig.DefaultBiome}" is not listed in Biomes[]`,
      severity: "warning",
      biomeSection: "BiomeRanges",
      code: "biome-range-default-not-listed",
      field: "DefaultBiome",
    });
  }

  for (const gap of validation.gaps) {
    diags.push({
      nodeId: null,
      message: `Gap in biome coverage from ${gap.start.toFixed(2)} to ${gap.end.toFixed(2)}`,
      severity: "warning",
      biomeSection: "BiomeRanges",
      code: "biome-range-gap",
      meta: { gapStart: gap.start, gapEnd: gap.end },
    });
  }

  for (const overlap of validation.overlaps) {
    diags.push({
      nodeId: null,
      message: `Overlapping ranges: ${overlap.biomeA} and ${overlap.biomeB} (${overlap.start.toFixed(2)}–${overlap.end.toFixed(2)})`,
      severity: "warning",
      biomeSection: "BiomeRanges",
      code: "biome-range-overlap",
      meta: { ...overlap },
    });
  }

  for (const name of validation.duplicateNames) {
    diags.push({
      nodeId: null,
      message: `Duplicate biome name in ranges: "${name}"`,
      severity: "warning",
      biomeSection: "BiomeRanges",
      code: "biome-range-duplicate-name",
      meta: { biome: name },
    });
  }

  for (const name of validation.missingBiomeFiles) {
    diags.push({
      nodeId: null,
      message: `Biome "${name}" is listed in ranges but has no matching file under Biomes/`,
      severity: "warning",
      biomeSection: "BiomeRanges",
      code: "biome-range-missing-file",
      meta: { biome: name },
    });
  }

  for (const name of validation.unassignedProjectBiomes) {
    diags.push({
      nodeId: null,
      message: `Project biome "${name}" is not assigned a noise range in this world`,
      severity: "info",
      biomeSection: "BiomeRanges",
      code: "biome-range-unassigned-project-biome",
      meta: { biome: name },
    });
  }

  return diags;
}

/** String warnings for export validation (reuse domain rules). */
export function biomeRangeExportWarnings(
  biomeRanges: BiomeRangeEntry[],
  noiseRangeConfig: NoiseRangeConfig | null,
): string[] {
  const warnings: string[] = [];
  const diags = analyzeNoiseRange({ biomeRanges, noiseRangeConfig });
  for (const d of diags) {
    if (d.severity === "error" || d.severity === "warning") {
      warnings.push(d.message);
    }
  }
  return warnings;
}
