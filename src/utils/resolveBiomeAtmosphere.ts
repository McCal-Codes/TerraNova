import type { AtmosphereSettings } from "@/stores/previewStore";
import { listDirectory, readAssetFile } from "@/utils/ipc";
import {
  buildAtmosphereSettings,
  FALLBACK_ATMOSPHERE_SETTINGS,
} from "@/utils/atmosphere/atmosphereSettings";
import {
  clearAtmosphereAssetIndexCache,
  getAssetIndex,
  loadEnvironmentWithParents,
  type AtmosphereAssetDeps,
} from "@/utils/atmosphere/environmentParents";
import { selectForecastWeatherId } from "@/utils/atmosphere/forecastSelection";
import {
  asRecord,
  normalizeAssetName,
  normalizeHour,
  toFiniteNumber,
  type JsonRecord,
} from "@/utils/atmosphere/jsonUtils";

export { normalizeColorToken } from "@/utils/atmosphere/colorTracks";
export { selectForecastWeatherId } from "@/utils/atmosphere/forecastSelection";

const DEFAULT_HOUR = 12;

export interface ResolveBiomeAtmosphereInput {
  biomeConfig: unknown;
  biomeFilePath?: string | null;
  projectPath?: string | null;
  hour?: number;
}

export interface ResolveBiomeAtmosphereMetadata {
  source: "hytale-assets" | "fallback";
  serverRoot: string | null;
  environmentName: string | null;
  environmentPath: string | null;
  weatherId: string | null;
  weatherPath: string | null;
  hour: number;
  warnings: string[];
}

export interface ResolveBiomeAtmosphereResult {
  settings: AtmosphereSettings;
  metadata: ResolveBiomeAtmosphereMetadata;
}

function trimTrailingSeparators(path: string): string {
  return path.replace(/[\\/]+$/, "");
}

function joinPath(base: string, child: string): string {
  const separator = base.includes("\\") ? "\\" : "/";
  const cleanedBase = trimTrailingSeparators(base);
  return `${cleanedBase}${separator}${child}`;
}

function restoreSeparators(sourcePath: string, normalizedPath: string): string {
  return sourcePath.includes("\\")
    ? normalizedPath.replace(/\//g, "\\")
    : normalizedPath;
}

function findServerRootFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const normalized = path.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  const marker = "/server/";
  const markerIndex = lower.lastIndexOf(marker);
  if (markerIndex >= 0) {
    const serverRoot = normalized.slice(0, markerIndex + marker.length - 1);
    return restoreSeparators(path, serverRoot);
  }
  if (lower.endsWith("/server")) {
    return trimTrailingSeparators(path);
  }
  return null;
}

function parentPath(path: string): string | null {
  const normalized = path.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) return null;
  return restoreSeparators(path, normalized.slice(0, lastSlash));
}

function buildServerRootCandidates(
  biomeFilePath: string | null | undefined,
  projectPath: string | null | undefined,
): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const pushCandidate = (candidate: string | null | undefined) => {
    if (!candidate) return;
    const cleaned = trimTrailingSeparators(candidate);
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(cleaned);
  };

  pushCandidate(findServerRootFromPath(biomeFilePath));
  pushCandidate(findServerRootFromPath(projectPath));

  if (projectPath) {
    const normalizedProject = trimTrailingSeparators(projectPath);
    const lowerProject = normalizedProject.toLowerCase();
    if (lowerProject.endsWith("/hytalegenerator") || lowerProject.endsWith("\\hytalegenerator")) {
      pushCandidate(parentPath(normalizedProject));
    }
    pushCandidate(joinPath(normalizedProject, "Server"));
  }

  return candidates;
}

export function clearResolveBiomeAtmosphereCache(): void {
  clearAtmosphereAssetIndexCache();
}

function getRangeMidpoint(range: unknown): number | null {
  const rangeObj = asRecord(range);
  if (!rangeObj) return null;

  const min = toFiniteNumber(
    rangeObj.MinInclusive ?? rangeObj.Min ?? rangeObj.From,
  );
  const max = toFiniteNumber(
    rangeObj.MaxExclusive ?? rangeObj.Max ?? rangeObj.To,
  );

  if (min !== null && max !== null) return (min + max) * 0.5;
  if (min !== null) return min;
  if (max !== null) return max;
  return null;
}

function pickEnvironmentFromDelimiter(delimiter: unknown): string | null {
  const delimiterObj = asRecord(delimiter);
  if (!delimiterObj) return null;

  const nestedProvider = asRecord(delimiterObj.Environment);
  if (nestedProvider) {
    return pickEnvironmentNameFromProvider(nestedProvider);
  }

  return normalizeAssetName(delimiterObj.Environment);
}

function pickEnvironmentFromDelimiters(delimiters: unknown): string | null {
  if (!Array.isArray(delimiters)) return null;

  const candidates = delimiters
    .map((delimiter, index) => {
      const delimiterObj = asRecord(delimiter);
      const environmentName = pickEnvironmentFromDelimiter(delimiterObj);
      if (!environmentName) return null;
      const rangeMidpoint = getRangeMidpoint(delimiterObj?.Range);
      return {
        environmentName,
        rangeMidpoint,
        index,
      };
    })
    .filter((candidate): candidate is { environmentName: string; rangeMidpoint: number | null; index: number } => candidate !== null);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aScore = a.rangeMidpoint ?? Number.NEGATIVE_INFINITY;
    const bScore = b.rangeMidpoint ?? Number.NEGATIVE_INFINITY;
    if (aScore === bScore) return a.index - b.index;
    return bScore - aScore;
  });

  return candidates[0].environmentName;
}

export function pickEnvironmentNameFromProvider(provider: unknown): string | null {
  const providerObj = asRecord(provider);
  if (!providerObj) return null;

  const type = typeof providerObj.Type === "string" ? providerObj.Type : "";
  if (type === "Default") return "Default";
  if (type === "Constant") {
    return normalizeAssetName(providerObj.Environment);
  }
  if (type === "Imported" || type === "Exported") {
    return normalizeAssetName(providerObj.Name);
  }
  if (type === "DensityDelimited") {
    return pickEnvironmentFromDelimiters(providerObj.Delimiters);
  }

  const directEnvironment = normalizeAssetName(providerObj.Environment);
  if (directEnvironment) return directEnvironment;
  return pickEnvironmentFromDelimiters(providerObj.Delimiters);
}

function fallbackResult(
  hour: number,
  warnings: string[],
  environmentName: string | null,
): ResolveBiomeAtmosphereResult {
  return {
    settings: { ...FALLBACK_ATMOSPHERE_SETTINGS },
    metadata: {
      source: "fallback",
      serverRoot: null,
      environmentName,
      environmentPath: null,
      weatherId: null,
      weatherPath: null,
      hour,
      warnings,
    },
  };
}

export async function resolveBiomeAtmosphere(
  input: ResolveBiomeAtmosphereInput,
  depsOverride: Partial<AtmosphereAssetDeps> = {},
): Promise<ResolveBiomeAtmosphereResult> {
  const deps: AtmosphereAssetDeps = {
    listDirectoryFn: depsOverride.listDirectoryFn ?? listDirectory,
    readAssetFileFn: depsOverride.readAssetFileFn ?? readAssetFile,
  };

  const hour = normalizeHour(
    Number.isFinite(input.hour) ? (input.hour as number) : DEFAULT_HOUR,
  );
  const warnings: string[] = [];
  const biomeConfig = asRecord(input.biomeConfig);
  const environmentProvider = biomeConfig?.EnvironmentProvider;
  const environmentName = pickEnvironmentNameFromProvider(environmentProvider);

  if (!environmentName) {
    warnings.push("Biome has no resolvable EnvironmentProvider.");
    return fallbackResult(hour, warnings, null);
  }

  const candidateServerRoots = buildServerRootCandidates(input.biomeFilePath, input.projectPath);
  if (candidateServerRoots.length === 0) {
    warnings.push("Could not infer a Server root path for Environment/Weather asset lookup.");
    return fallbackResult(hour, warnings, environmentName);
  }

  let lastError: string | null = null;

  for (const serverRoot of candidateServerRoots) {
    try {
      const assetIndex = await getAssetIndex(serverRoot, deps);
      const resolvedEnvironmentName = assetIndex.environmentPaths.has(environmentName.toLowerCase())
        ? environmentName
        : assetIndex.environmentPaths.has("default")
          ? "Default"
          : null;

      if (!resolvedEnvironmentName) {
        warnings.push(`Environment "${environmentName}" was not found under ${serverRoot}.`);
        continue;
      }

      const loadedEnvironment = await loadEnvironmentWithParents(
        resolvedEnvironmentName,
        assetIndex,
        deps,
      );
      warnings.push(...loadedEnvironment.warnings);

      if (!loadedEnvironment.mergedEnvironment) {
        continue;
      }

      const weatherId = selectForecastWeatherId(
        loadedEnvironment.mergedEnvironment.WeatherForecasts,
        hour,
      );

      let weatherPath: string | null = null;
      let weatherJson: JsonRecord | null = null;

      if (weatherId) {
        weatherPath = assetIndex.weatherPaths.get(weatherId.toLowerCase()) ?? null;
        if (weatherPath) {
          const rawWeather = await deps.readAssetFileFn(weatherPath);
          weatherJson = asRecord(rawWeather);
          if (!weatherJson) {
            warnings.push(`Weather file "${weatherPath}" is not a JSON object.`);
          }
        } else {
          warnings.push(`Weather "${weatherId}" was not found in Server/Weathers.`);
        }
      } else {
        warnings.push(`Environment "${resolvedEnvironmentName}" did not resolve a weather forecast.`);
      }

      const settings = buildAtmosphereSettings(
        loadedEnvironment.mergedEnvironment,
        weatherJson,
        hour,
      );

      return {
        settings,
        metadata: {
          source: "hytale-assets",
          serverRoot,
          environmentName: resolvedEnvironmentName,
          environmentPath: loadedEnvironment.requestedPath,
          weatherId,
          weatherPath,
          hour,
          warnings,
        },
      };
    } catch (error) {
      lastError = String(error);
    }
  }

  if (lastError) {
    warnings.push(`Atmosphere resolution failed: ${lastError}`);
  }
  return fallbackResult(hour, warnings, environmentName);
}
