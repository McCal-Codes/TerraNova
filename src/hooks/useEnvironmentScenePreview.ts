import { useMemo } from "react";
import {
  getEffectiveForecastHour,
  readForecastHour,
  selectDominantForecastEntry,
  type JsonRecord,
} from "@/utils/atmosphere";
import { inferServerRoot } from "@/utils/pathUtils";
import { useEffectiveEnvironment } from "./useEffectiveEnvironment";
import { useWeatherAssetIndex } from "./useWeatherAssetIndex";
import { useWeatherDocCache } from "./useWeatherDocCache";

const FORECAST_HOURS = Array.from({ length: 24 }, (_, index) => index);

function collectForecastWeatherIds(doc: JsonRecord, mergedEnvironment: JsonRecord | null): string[] {
  const ids = new Set<string>();
  for (const hour of FORECAST_HOURS) {
    for (const entry of readForecastHour(doc, hour)) {
      if (entry.WeatherId) ids.add(entry.WeatherId);
    }
    if (mergedEnvironment) {
      for (const entry of readForecastHour(mergedEnvironment, hour)) {
        if (entry.WeatherId) ids.add(entry.WeatherId);
      }
    }
  }
  return [...ids];
}

export interface UseEnvironmentScenePreviewInput {
  environmentDoc: JsonRecord | null;
  environmentName: string | null;
  currentFile: string | null;
  projectPath: string | null;
  previewHour: number;
  lookupRevision?: number;
}

export function useEnvironmentScenePreview({
  environmentDoc,
  environmentName,
  currentFile,
  projectPath,
  previewHour,
  lookupRevision = 0,
}: UseEnvironmentScenePreviewInput) {
  const serverRoot = useMemo(
    () => inferServerRoot(currentFile, projectPath),
    [currentFile, projectPath],
  );

  const { mergedEnvironment } = useEffectiveEnvironment(
    environmentDoc,
    environmentName,
    serverRoot,
    lookupRevision,
  );

  const {
    status: lookupStatus,
    options: weatherOptions,
    pathIndex: weatherPathIndex,
    error: lookupError,
  } = useWeatherAssetIndex(currentFile, projectPath, lookupRevision);

  const forecastWeatherIds = useMemo(
    () => collectForecastWeatherIds(environmentDoc ?? {}, mergedEnvironment),
    [environmentDoc, mergedEnvironment],
  );

  const weatherDocs = useWeatherDocCache(weatherPathIndex, forecastWeatherIds, lookupRevision);

  const effectiveForecast = useMemo(() => {
    if (!environmentDoc) return null;
    return getEffectiveForecastHour(environmentDoc, mergedEnvironment, previewHour);
  }, [environmentDoc, mergedEnvironment, previewHour]);

  const dominantEntry = effectiveForecast
    ? selectDominantForecastEntry(effectiveForecast.entries)
    : null;

  const sceneWeatherDoc = dominantEntry?.WeatherId
    ? weatherDocs[dominantEntry.WeatherId.toLowerCase()] ?? null
    : null;

  return {
    serverRoot,
    mergedEnvironment,
    weatherDocs,
    weatherPathIndex,
    lookupStatus,
    weatherFileCount: weatherOptions.length,
    lookupError,
    effectiveForecast,
    dominantEntry,
    sceneWeatherDoc,
  };
}
