import { interpolateColorAtHour, type HourColor, type HourValue } from "@/utils/atmosphere";
import type { EditorCalloutItem } from "../EditorCallouts";
import {
  COLOR_TRACKS,
  VALUE_TRACKS,
  type CloudLayer,
  type WeatherDoc,
} from "./weatherEditorConstants";
import { HOURS } from "./weatherEditorConstants";

export interface WeatherIssueContext {
  doc: WeatherDoc;
  cloudLayers: CloudLayer[];
  starTexture: string | null;
  moonCount: number;
  extraFieldCount: number;
  onSetFogDefaults: () => void;
  onSwapFogDistance: () => void;
  onDeduplicateTracks: () => void;
  onAddCelestialDefaults: () => void;
  onAddCloudDefaults: () => void;
}

export function computeWeatherIssues(ctx: WeatherIssueContext): EditorCalloutItem[] {
  const items: EditorCalloutItem[] = [];
  const essentialMissing = [
    { key: "SkyTopColors", label: "Sky Top" },
    { key: "SkyBottomColors", label: "Sky Bottom" },
    { key: "FogColors", label: "Fog" },
    { key: "SunColors", label: "Sun" },
  ].filter(({ key }) => (((ctx.doc[key] as HourColor[] | undefined) ?? []).length === 0));

  if (essentialMissing.length > 0) {
    items.push({
      severity: "warning",
      title: "Core color tracks are missing",
      detail: `${essentialMissing.map((track) => track.label).join(", ")} will fall back to default preview colors until they are populated.`,
    });
  }

  if (!Array.isArray(ctx.doc.FogDistance) || ctx.doc.FogDistance.length < 2) {
    items.push({
      severity: "warning",
      title: "Fog distance is not configured",
      detail: "Set near/far fog bounds so the preview volume matches the real weather file.",
      fix: { label: "Set defaults", onFix: () => ctx.onSetFogDefaults() },
    });
  } else if ((ctx.doc.FogDistance[1] ?? 0) <= (ctx.doc.FogDistance[0] ?? 0)) {
    items.push({
      severity: "error",
      title: "Fog distance range is inverted",
      detail: `Far (${ctx.doc.FogDistance[1]}) should be greater than near (${ctx.doc.FogDistance[0]}).`,
      fix: { label: "Swap values", onFix: () => ctx.onSwapFogDistance() },
    });
  }

  const duplicateTrackWarnings = [
    ...COLOR_TRACKS.flatMap((track) => {
      const duplicates = findDuplicateHours((ctx.doc[track.key] as HourColor[] | undefined) ?? []);
      return duplicates.length > 0 ? [`${track.label} @ ${duplicates.join(", ")}`] : [];
    }),
    ...VALUE_TRACKS.flatMap((track) => {
      const duplicates = findDuplicateHours((ctx.doc[track.key] as HourValue[] | undefined) ?? []);
      return duplicates.length > 0 ? [`${track.label} @ ${duplicates.join(", ")}`] : [];
    }),
    ...ctx.cloudLayers.flatMap((layer, index) => {
      const colorDupes = findDuplicateHours(layer.Colors ?? []);
      const speedDupes = findDuplicateHours(layer.Speeds ?? []);
      const label = `Cloud ${index + 1}`;
      return [
        ...(colorDupes.length > 0 ? [`${label} colors @ ${colorDupes.join(", ")}`] : []),
        ...(speedDupes.length > 0 ? [`${label} speeds @ ${speedDupes.join(", ")}`] : []),
      ];
    }),
  ];

  if (duplicateTrackWarnings.length > 0) {
    items.push({
      severity: "warning",
      title: "Duplicate hour keys detected",
      detail: duplicateTrackWarnings.slice(0, 4).join(" | "),
      fix: { label: "Deduplicate", onFix: () => ctx.onDeduplicateTracks() },
    });
  }

  if (!ctx.starTexture && ctx.moonCount === 0) {
    items.push({
      severity: "info",
      title: "No celestial assets configured",
      detail: "This file has neither a star texture nor moon entries, so the night preview will stay visually sparse.",
      fix: { label: "Add defaults", onFix: () => ctx.onAddCelestialDefaults() },
    });
  }

  if (ctx.cloudLayers.length === 0) {
    items.push({
      severity: "info",
      title: "No cloud layers present",
      detail: "The sky preview is currently driven only by color tracks and celestial settings.",
      fix: { label: "Add cloud layer", onFix: () => ctx.onAddCloudDefaults() },
    });
  }

  if (ctx.extraFieldCount > 0) {
    items.push({
      severity: "info",
      title: "Additional weather fields detected",
      detail: `${ctx.extraFieldCount} fields are present outside the first-class editor model. Check the metadata card for raw values.`,
    });
  }

  return items;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function describeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (isRecord(value)) {
    return `${Object.keys(value).length} field${Object.keys(value).length === 1 ? "" : "s"}`;
  }
  return "Unsupported value";
}

export function sectionClass(isFocused: boolean): string {
  return `rounded border p-3 transition-colors ${
    isFocused
      ? "border-tn-accent/70 bg-tn-accent/10 shadow-[0_0_0_1px_rgba(100,180,255,0.18)]"
      : "border-tn-border/60 bg-tn-surface/40"
  }`;
}

export function formatTrackValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function buildTrackGradient(keyframes: HourColor[]): string {
  return keyframes.length
    ? HOURS.map((hour) => `${interpolateColorAtHour(keyframes, hour)} ${(hour / 23) * 100}%`).join(", ")
    : "transparent";
}

export function readTextureLabel(value: string | undefined): string {
  if (!value) {
    return "Not configured";
  }
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? value;
}

export function describeDaypart(hour: number): { label: string; description: string; accent: string } {
  if (hour <= 4) {
    return { label: "Deep Night", description: "Stars and moon dominate the sky gradient.", accent: "#334155" };
  }
  if (hour <= 6) {
    return { label: "Dawn", description: "Sunrise ramp and fog colors start to warm up.", accent: "#fb7185" };
  }
  if (hour <= 11) {
    return { label: "Morning", description: "Sky tracks brighten while fog begins to lift.", accent: "#fbbf24" };
  }
  if (hour <= 15) {
    return { label: "Midday", description: "Maximum light, flatter fog and strongest sky contrast.", accent: "#38bdf8" };
  }
  if (hour <= 18) {
    return { label: "Afternoon", description: "Sun starts to fall and warm tones begin to return.", accent: "#f59e0b" };
  }
  if (hour <= 20) {
    return { label: "Dusk", description: "Sunset and fog tracks become the dominant mood.", accent: "#f97316" };
  }
  return { label: "Nightfall", description: "Scene transitions back into moonlight and star visibility.", accent: "#6366f1" };
}

export function findDuplicateHours(entries: Array<{ Hour: number }>): number[] {
  const counts = new Map<number, number>();
  for (const entry of entries) {
    counts.set(entry.Hour, (counts.get(entry.Hour) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([hour]) => hour)
    .sort((left, right) => left - right);
}
