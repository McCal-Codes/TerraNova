import type { AtmosphereSettings } from "@/stores/previewStore";
import { listDirectory, readAssetFile } from "@/utils/ipc";
import { buildAtmosphereSettings } from "./atmosphereSettings";
import {
  getAssetIndex,
  loadEnvironmentWithParents,
  type AtmosphereAssetDeps,
} from "./environmentParents";
import { selectForecastWeatherId } from "./forecastSelection";
import { asRecord, normalizeHour, type JsonRecord } from "./jsonUtils";

export interface ResolveEnvironmentAtmosphereInput {
  environmentName: string;
  serverRoot: string;
  hour?: number;
  localEnvironmentDoc?: JsonRecord | null;
}

export interface ResolveEnvironmentAtmosphereResult {
  settings: AtmosphereSettings;
  mergedEnvironment: JsonRecord | null;
  weatherId: string | null;
  weatherDoc: JsonRecord | null;
  weatherPath: string | null;
  environmentPath: string | null;
  parentChain: string[];
  hour: number;
  warnings: string[];
}

export async function resolveEnvironmentAtmosphere(
  input: ResolveEnvironmentAtmosphereInput,
  depsOverride: Partial<AtmosphereAssetDeps> = {},
): Promise<ResolveEnvironmentAtmosphereResult> {
  const deps: AtmosphereAssetDeps = {
    listDirectoryFn: depsOverride.listDirectoryFn ?? listDirectory,
    readAssetFileFn: depsOverride.readAssetFileFn ?? readAssetFile,
  };

  const hour = normalizeHour(Number.isFinite(input.hour) ? (input.hour as number) : 12);
  const warnings: string[] = [];
  const assetIndex = await getAssetIndex(input.serverRoot, deps);
  const loaded = await loadEnvironmentWithParents(input.environmentName, assetIndex, deps);
  warnings.push(...loaded.warnings);

  let mergedEnvironment = loaded.mergedEnvironment;
  if (input.localEnvironmentDoc && mergedEnvironment) {
    mergedEnvironment = {
      ...mergedEnvironment,
      ...input.localEnvironmentDoc,
      WeatherForecasts: input.localEnvironmentDoc.WeatherForecasts ?? mergedEnvironment.WeatherForecasts,
    };
  } else if (input.localEnvironmentDoc) {
    mergedEnvironment = input.localEnvironmentDoc;
  }

  if (!mergedEnvironment) {
    return {
      settings: buildAtmosphereSettings(null, null, hour),
      mergedEnvironment: null,
      weatherId: null,
      weatherDoc: null,
      weatherPath: null,
      environmentPath: loaded.requestedPath,
      parentChain: loaded.parentChain,
      hour,
      warnings,
    };
  }

  const weatherId = selectForecastWeatherId(mergedEnvironment.WeatherForecasts, hour);
  let weatherPath: string | null = null;
  let weatherDoc: JsonRecord | null = null;

  if (weatherId) {
    weatherPath = assetIndex.weatherPaths.get(weatherId.toLowerCase()) ?? null;
    if (weatherPath) {
      const rawWeather = await deps.readAssetFileFn(weatherPath);
      weatherDoc = asRecord(rawWeather);
      if (!weatherDoc) {
        warnings.push(`Weather file "${weatherPath}" is not a JSON object.`);
      }
    } else {
      warnings.push(`Weather "${weatherId}" was not found in Server/Weathers.`);
    }
  } else {
    warnings.push(`Environment "${input.environmentName}" did not resolve a weather forecast for hour ${hour}.`);
  }

  return {
    settings: buildAtmosphereSettings(mergedEnvironment, weatherDoc, hour),
    mergedEnvironment,
    weatherId,
    weatherDoc,
    weatherPath,
    environmentPath: loaded.requestedPath,
    parentChain: loaded.parentChain,
    hour,
    warnings,
  };
}

export async function resolveWeatherAtmosphere(
  weatherDoc: JsonRecord,
  hour?: number,
): Promise<AtmosphereSettings> {
  const normalizedHour = normalizeHour(Number.isFinite(hour) ? (hour as number) : 12);
  return buildAtmosphereSettings(null, weatherDoc, normalizedHour);
}
