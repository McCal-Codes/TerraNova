export {
  buildDefaultWeatherDoc,
} from "./defaultWeatherDoc";

export {
  normalizeColorToken,
  readHexColor,
  readAlpha,
  buildColorString,
  sampleColorAtHour,
  interpolateColorAtHour,
  sampleValueAtHour,
  interpolateValueAtHour,
  upsertColorKeyframe,
  upsertValueKeyframe,
  normalizeHourInput,
  type HourColor,
  type HourValue,
} from "./colorTracks";

export {
  selectForecastWeatherId,
  readForecastHour,
  collectForecastWeatherIds,
  selectDominantForecastEntry,
  getEffectiveForecastHour,
  hasEffectiveForecastCoverage,
  type WeatherForecastEntry,
  type EffectiveForecastHour,
} from "./forecastSelection";

export {
  inferSuggestedParentEnvironment,
  loadEnvironmentWithParents,
  loadEnvironmentDocWithParentsFromFile,
  getAssetIndex,
  buildAssetIndex,
  clearAtmosphereAssetIndexCache,
  createAssetNameIndex,
  type AssetIndex,
  type LoadedEnvironment,
  type AtmosphereAssetDeps,
} from "./environmentParents";

export {
  buildAtmosphereSettings,
  sampleWeatherSkyGradient,
  scanWeatherAssetIndex,
  isPathInProject,
  FALLBACK_ATMOSPHERE_SETTINGS,
  type WeatherAssetIndexResult,
} from "./atmosphereSettings";

export {
  resolveEnvironmentAtmosphere,
  resolveWeatherAtmosphere,
  type ResolveEnvironmentAtmosphereInput,
  type ResolveEnvironmentAtmosphereResult,
} from "./resolveEnvironmentAtmosphere";

export {
  materializeWeatherFiles,
  type MaterializeWeatherFilesInput,
  type MaterializeWeatherFilesResult,
} from "./materializeWeather";

export {
  asRecord,
  deepMergeRecords,
  normalizeAssetName,
  normalizeHour,
  type JsonRecord,
} from "./jsonUtils";

export {
  isEmptyEnvironmentProvider,
  usesServerDefaultEnvironment,
  describeEnvironmentProvider,
} from "./environmentProvider";
