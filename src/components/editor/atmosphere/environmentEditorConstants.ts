import type { WeatherForecastEntry } from "@/utils/atmosphere";
import { ATMOSPHERE_HOURS } from "@/utils/atmosphere/atmosphereHours";

export type WeatherForecastMap = Record<string, WeatherForecastEntry[]>;

export interface EnvironmentDoc extends Record<string, unknown> {
  Parent?: string;
  Tags?: Record<string, string[]>;
  WeatherForecasts?: WeatherForecastMap;
  WaterTint?: string;
  SpawnDensity?: number;
  BlockModificationAllowed?: boolean;
}

export const HOURS = ATMOSPHERE_HOURS;

export const DAYPARTS = [
  { id: "night", label: "Night", start: 0, end: 3, accent: "#2563eb" },
  { id: "dawn", label: "Dawn", start: 4, end: 7, accent: "#f97316" },
  { id: "morning", label: "Morning", start: 8, end: 11, accent: "#22c55e" },
  { id: "afternoon", label: "Afternoon", start: 12, end: 15, accent: "#facc15" },
  { id: "evening", label: "Evening", start: 16, end: 19, accent: "#a855f7" },
  { id: "late", label: "Late", start: 20, end: 23, accent: "#0f172a" },
] as const;
