import {
  getEffectiveForecastHour,
  hasEffectiveForecastCoverage,
  readForecastHour,
  type JsonRecord,
} from "@/utils/atmosphere";
import type { EditorCalloutItem } from "../EditorCallouts";
import { HOURS, type EnvironmentDoc } from "./environmentEditorConstants";

export interface EnvironmentIssueContext {
  doc: EnvironmentDoc;
  mergedEnvironment: JsonRecord | null;
  suggestedParentEnvironment: string | null;
  hytaleOnlyIds: string[];
  missingIds: string[];
  lookupStatus: string;
  lookupError: string | null | undefined;
  tagCount: number;
  extraFieldCount: number;
  onUseSuggestedParent: (parent: string) => void;
  onImportHytaleWeather: (ids: string[]) => void;
  onCreateMissingWeather: (ids: string[]) => void;
  onCreateDefaultWeather: () => void;
}

export function computeEnvironmentIssues(ctx: EnvironmentIssueContext): EditorCalloutItem[] {
  const items: EditorCalloutItem[] = [];
  const localDoc = ctx.doc as JsonRecord;
  const mergedDoc = ctx.mergedEnvironment;
  const missingLocalHours = HOURS.filter((hour) => readForecastHour(localDoc, hour).length === 0);
  const missingEffectiveHours = HOURS.filter(
    (hour) => getEffectiveForecastHour(localDoc, mergedDoc, hour).entries.length === 0,
  );
  const hasLocalForecasts = missingLocalHours.length < HOURS.length;
  const hasEffectiveCoverage = hasEffectiveForecastCoverage(localDoc, mergedDoc, HOURS);
  const nonPositiveWeights = HOURS.flatMap((hour) => readForecastHour(localDoc, hour)
    .filter((entry) => entry.Weight <= 0)
    .map((entry) => `${hour}:00 ${entry.WeatherId || "(blank id)"}`));

  if (!ctx.doc.Parent?.trim()) {
    items.push({
      severity: "warning",
      title: "Parent environment is missing",
      detail: "Real Hytale assets usually point specialized files at a shared base parent: Env_Zone1_Azure -> Env_Zone1, Env_Zone1_Caves_Forests -> Env_Zone1_Caves, Env_Forgotten_Temple_Exterior -> Env_Forgotten_Temple_Base.",
      fix: ctx.suggestedParentEnvironment
        ? {
            label: `Use ${ctx.suggestedParentEnvironment}`,
            onFix: () => ctx.onUseSuggestedParent(ctx.suggestedParentEnvironment!),
          }
        : undefined,
    });
  }

  if (!hasEffectiveCoverage) {
    items.push(ctx.doc.Parent?.trim() && !hasLocalForecasts
      ? {
          severity: "info",
          title: "No local hourly forecasts on this file",
          detail: `This environment likely inherits its WeatherForecasts from parent ${ctx.doc.Parent}. Effective coverage could not be resolved from the parent chain yet.`,
        }
      : {
          severity: ctx.doc.Parent?.trim() ? "warning" : "error",
          title: "No effective hourly forecast coverage",
          detail: missingEffectiveHours.length === HOURS.length
            ? "Populate WeatherForecasts locally or ensure the parent chain resolves before relying on this environment in preview or export."
            : `${missingEffectiveHours.length} of 24 hours lack effective forecast entries. First gaps: ${missingEffectiveHours.slice(0, 6).join(", ")}.`,
        });
  } else if (missingLocalHours.length > 0 && ctx.doc.Parent?.trim()) {
    items.push({
      severity: "info",
      title: "Some hours inherit forecasts from parent",
      detail: `${missingLocalHours.length} of 24 hours have no local entries and use inherited forecasts from ${ctx.doc.Parent}.`,
    });
  } else if (missingLocalHours.length > 0 && hasLocalForecasts) {
    items.push({
      severity: "warning",
      title: "Some forecast hours are empty locally",
      detail: `${missingLocalHours.length} of 24 hours have no local weather entries. First gaps: ${missingLocalHours.slice(0, 6).join(", ")}.`,
    });
  }

  if (ctx.hytaleOnlyIds.length > 0) {
    items.push({
      severity: "info",
      title: "Referenced weather files are not in this pack yet",
      detail: ctx.hytaleOnlyIds.slice(0, 6).join(", "),
      fix: {
        label: "Import files",
        onFix: () => ctx.onImportHytaleWeather(ctx.hytaleOnlyIds),
      },
    });
  }

  if (ctx.missingIds.length > 0) {
    items.push({
      severity: "warning",
      title: "Some weather IDs do not resolve to files",
      detail: ctx.missingIds.slice(0, 6).join(", "),
      fix: {
        label: "Create files",
        onFix: () => ctx.onCreateMissingWeather(ctx.missingIds),
      },
    });
  }

  if (nonPositiveWeights.length > 0) {
    items.push({
      severity: "warning",
      title: "Non-positive forecast weights found",
      detail: nonPositiveWeights.slice(0, 5).join(" | "),
    });
  }

  if (ctx.lookupStatus === "error") {
    const isNotFound = ctx.lookupError?.includes("not found") ?? false;
    items.push({
      severity: isNotFound ? "warning" : "error",
      title: isNotFound ? "Weather directory not found" : "Weather directory lookup failed",
      detail: ctx.lookupError ?? "Could not read Server/Weathers for forecast validation.",
      fix: isNotFound
        ? {
            label: "Create folder",
            onFix: () => ctx.onCreateDefaultWeather(),
          }
        : undefined,
    });
  }

  if (ctx.tagCount === 0) {
    items.push({
      severity: "info",
      title: "No environment tags defined",
      detail: "Tags are optional, but adding them makes the file easier to classify alongside real Hytale assets.",
    });
  }

  if (ctx.extraFieldCount > 0) {
    items.push({
      severity: "info",
      title: "Additional environment fields detected",
      detail: `${ctx.extraFieldCount} fields exist outside the first-class editor surface. Review the raw section before shipping.`,
    });
  }

  return items;
}

export function summarizeDaypart(doc: EnvironmentDoc, start: number, end: number) {
  const weatherWeights = new Map<string, number>();
  let totalEntries = 0;

  for (let hour = start; hour <= end; hour += 1) {
    for (const entry of readForecastHour(doc, hour)) {
      totalEntries += 1;
      weatherWeights.set(entry.WeatherId, (weatherWeights.get(entry.WeatherId) ?? 0) + entry.Weight);
    }
  }

  const sortedWeather = [...weatherWeights.entries()].sort((left, right) => right[1] - left[1]);
  return {
    totalEntries,
    sortedWeather,
    dominantWeatherId: sortedWeather[0]?.[0] ?? null,
    uniqueWeatherCount: sortedWeather.length,
  };
}

export function collectWeatherUsage(doc: EnvironmentDoc) {
  const usage = new Map<string, { hours: number[]; totalWeight: number; appearances: number }>();

  for (const hour of HOURS) {
    for (const entry of readForecastHour(doc, hour)) {
      const current = usage.get(entry.WeatherId) ?? { hours: [], totalWeight: 0, appearances: 0 };
      if (!current.hours.includes(hour)) {
        current.hours.push(hour);
      }
      current.totalWeight += entry.Weight;
      current.appearances += 1;
      usage.set(entry.WeatherId, current);
    }
  }

  return usage;
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function sanitizeTagValues(input: string): string[] {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getDisplayedForecastHours(
  scope: "current" | "daypart" | "all",
  previewHour: number,
  selectedDaypart: { start: number; end: number } | null,
): number[] {
  if (scope === "current") return [previewHour];
  if (scope === "daypart" && selectedDaypart) {
    return HOURS.filter((hour) => hour >= selectedDaypart.start && hour <= selectedDaypart.end);
  }
  return HOURS;
}
