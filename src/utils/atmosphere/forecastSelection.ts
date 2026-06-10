import {
  asRecord,
  hourDistance,
  normalizeHour,
  toFiniteNumber,
  type JsonRecord,
} from "./jsonUtils";

export interface WeatherForecastEntry {
  WeatherId: string;
  Weight: number;
}

function parseForecastEntry(raw: unknown): WeatherForecastEntry | null {
  const record = asRecord(raw);
  if (!record) return null;
  const weatherId = typeof record.WeatherId === "string"
    ? record.WeatherId
    : typeof record.Weather === "string"
      ? record.Weather
      : "";
  if (!weatherId) return null;
  return {
    WeatherId: weatherId,
    Weight: toFiniteNumber(record.Weight) ?? 100,
  };
}

function parseForecastBucket(raw: unknown): WeatherForecastEntry[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => parseForecastEntry(entry))
      .filter((entry): entry is WeatherForecastEntry => entry !== null);
  }
  const single = parseForecastEntry(raw);
  return single ? [single] : [];
}

/** Collect every weather id referenced in WeatherForecasts (map or Hytale array shape). */
export function collectForecastWeatherIds(doc: JsonRecord): string[] {
  const raw = doc.WeatherForecasts;
  const ids = new Set<string>();

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const parsed = parseForecastEntry(entry);
      if (parsed?.WeatherId) ids.add(parsed.WeatherId);
    }
    return [...ids];
  }

  const forecasts = asRecord(raw);
  if (!forecasts) return [];
  for (const bucket of Object.values(forecasts)) {
    for (const entry of parseForecastBucket(bucket)) {
      if (entry.WeatherId) ids.add(entry.WeatherId);
    }
  }
  return [...ids];
}

function pickClosestHourBucket(
  buckets: Array<{ hour: number; options: unknown }>,
  hour: number,
): unknown {
  if (buckets.length === 0) return null;
  const normalized = normalizeHour(hour);

  let bestBucket = buckets[0];
  let bestDistance = hourDistance(normalized, bestBucket.hour);
  for (let index = 1; index < buckets.length; index += 1) {
    const candidate = buckets[index];
    const distance = hourDistance(normalized, candidate.hour);
    if (distance < bestDistance) {
      bestBucket = candidate;
      bestDistance = distance;
    }
  }

  return bestBucket.options;
}

export function readForecastHour(doc: JsonRecord, hour: number): WeatherForecastEntry[] {
  const raw = doc.WeatherForecasts;
  const normalizedHour = normalizeHour(hour);

  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        const record = asRecord(entry);
        if (!record) return null;
        const entryHour = toFiniteNumber(record.Hour);
        if (entryHour == null || normalizeHour(entryHour) !== normalizedHour) return null;
        return parseForecastEntry(record);
      })
      .filter((entry): entry is WeatherForecastEntry => entry !== null);
  }

  const forecasts = asRecord(raw);
  if (!forecasts) return [];
  return parseForecastBucket(forecasts[String(hour)]);
}

export function selectDominantForecastEntry(entries: WeatherForecastEntry[]): WeatherForecastEntry | null {
  return entries.reduce<WeatherForecastEntry | null>((best, current) => (
    !best || current.Weight > best.Weight ? current : best
  ), null);
}

export function selectForecastWeatherId(weatherForecasts: unknown, hour: number): string | null {
  if (Array.isArray(weatherForecasts)) {
    const entries = readForecastHour({ WeatherForecasts: weatherForecasts }, hour);
    return selectDominantForecastEntry(entries)?.WeatherId ?? null;
  }

  const forecastObj = asRecord(weatherForecasts);
  if (!forecastObj) return null;

  const buckets = Object.entries(forecastObj)
    .map(([hourKey, options]) => {
      const parsedHour = Number(hourKey);
      if (!Number.isFinite(parsedHour)) return null;
      return {
        hour: normalizeHour(parsedHour),
        options,
      };
    })
    .filter((bucket): bucket is { hour: number; options: unknown } => bucket !== null);

  const selectedBucket = pickClosestHourBucket(buckets, hour);
  const entries = parseForecastBucket(selectedBucket);
  return selectDominantForecastEntry(entries)?.WeatherId ?? null;
}

export interface EffectiveForecastHour {
  hour: number;
  entries: WeatherForecastEntry[];
  source: "local" | "inherited" | "none";
}

export function getEffectiveForecastHour(
  localDoc: JsonRecord,
  mergedDoc: JsonRecord | null,
  hour: number,
): EffectiveForecastHour {
  const localEntries = readForecastHour(localDoc, hour);
  if (localEntries.length > 0) {
    return { hour, entries: localEntries, source: "local" };
  }

  if (mergedDoc) {
    const inheritedEntries = readForecastHour(mergedDoc, hour);
    if (inheritedEntries.length > 0) {
      return { hour, entries: inheritedEntries, source: "inherited" };
    }
  }

  return { hour, entries: [], source: "none" };
}

export function hasEffectiveForecastCoverage(
  localDoc: JsonRecord,
  mergedDoc: JsonRecord | null,
  hours: number[] = Array.from({ length: 24 }, (_, index) => index),
): boolean {
  return hours.every((hour) => getEffectiveForecastHour(localDoc, mergedDoc, hour).entries.length > 0);
}
