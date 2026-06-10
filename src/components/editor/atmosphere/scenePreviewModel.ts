import {
  interpolateColorAtHour,
  interpolateValueAtHour,
  sampleColorAtHour,
  type HourColor,
  type HourValue,
  type JsonRecord,
} from "@/utils/atmosphere";

export interface WeatherSceneDoc extends JsonRecord {
  SkyTopColors?: HourColor[];
  SkyBottomColors?: HourColor[];
  SkySunsetColors?: HourColor[];
  FogColors?: HourColor[];
  SunColors?: HourColor[];
  MoonColors?: HourColor[];
  MoonGlowColors?: HourColor[];
  SunGlowColors?: HourColor[];
  WaterTints?: HourColor[];
  SunlightColors?: HourColor[];
  SunScales?: HourValue[];
  MoonScales?: HourValue[];
  FogDensities?: HourValue[];
  Clouds?: Array<{ Colors?: HourColor[]; Speeds?: HourValue[] }>;
}

export interface SceneDaypart {
  label: string;
  description: string;
  accent: string;
}

export interface ScenePreviewModel {
  skyTop: string;
  skyBottom: string;
  sunsetColor: string;
  fogColor: string;
  sunColor: string;
  sunGlowColor: string;
  moonColor: string;
  sunlightColor: string;
  waterTint: string;
  sunScale: number;
  moonScale: number;
  fogDensity: number;
  cloudLayers: NonNullable<WeatherSceneDoc["Clouds"]>;
  daypart: SceneDaypart;
  nightFactor: number;
  sunVisible: boolean;
  moonVisible: boolean;
  sunX: number;
  sunY: number;
  moonX: number;
  moonY: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function describeSceneDaypart(hour: number): SceneDaypart {
  if (hour <= 4) return { label: "Deep Night", description: "Stars and moon dominate the sky.", accent: "#334155" };
  if (hour <= 6) return { label: "Dawn", description: "Sunrise warmth enters the sky and fog.", accent: "#fb7185" };
  if (hour <= 11) return { label: "Morning", description: "Sky brightens as fog lifts.", accent: "#fbbf24" };
  if (hour <= 15) return { label: "Midday", description: "Strongest light and sky contrast.", accent: "#38bdf8" };
  if (hour <= 18) return { label: "Afternoon", description: "Warm tones return as the sun falls.", accent: "#f59e0b" };
  if (hour <= 20) return { label: "Dusk", description: "Sunset and fog drive the mood.", accent: "#f97316" };
  return { label: "Nightfall", description: "Moonlight and stars take over.", accent: "#6366f1" };
}

function sampleWeatherColor(
  keyframes: HourColor[] | undefined,
  hour: number,
  fallback: string,
): string {
  return sampleColorAtHour(keyframes, hour) ?? interpolateColorAtHour(keyframes, hour, fallback);
}

export function buildScenePreviewModel(doc: WeatherSceneDoc, previewHour: number): ScenePreviewModel {
  const skyTop = sampleWeatherColor(doc.SkyTopColors, previewHour, "#28405a");
  const skyBottom = sampleWeatherColor(doc.SkyBottomColors, previewHour, "#0f172a");
  const sunsetColor = sampleWeatherColor(doc.SkySunsetColors, previewHour, "#fb923c");
  const fogColor = sampleWeatherColor(doc.FogColors, previewHour, "#223142");
  const sunColor = sampleWeatherColor(doc.SunColors, previewHour, "#fbbf24");
  const sunGlowColor = sampleWeatherColor(doc.SunGlowColors, previewHour, sunColor);
  const moonColor = sampleWeatherColor(doc.MoonColors, previewHour, "#cbd5f5");
  const sunlightColor = sampleWeatherColor(doc.SunlightColors, previewHour, "#fde68a");
  const waterTint = sampleWeatherColor(doc.WaterTints, previewHour, "#1e4d8b");
  const sunScale = interpolateValueAtHour(doc.SunScales, previewHour, 0.5);
  const moonScale = interpolateValueAtHour(doc.MoonScales, previewHour, 0.45);
  const fogDensity = interpolateValueAtHour(doc.FogDensities, previewHour, 0);
  const cloudLayers = Array.isArray(doc.Clouds) ? doc.Clouds : [];
  const daypart = describeSceneDaypart(previewHour);

  const nightFactor = previewHour <= 5
    ? 1 - (previewHour / 6)
    : previewHour >= 18
      ? clamp((previewHour - 18) / 5, 0, 1)
      : 0;

  const sunVisible = previewHour >= 5 && previewHour <= 20;
  const moonVisible = previewHour <= 7 || previewHour >= 17;

  const daylightProgress = clamp((previewHour - 6) / 12, 0, 1);
  const sunX = 10 + (daylightProgress * 72);
  const sunY = 54 - (Math.sin(daylightProgress * Math.PI) * 40);

  const moonProgress = previewHour <= 7 ? (previewHour + 6) / 13 : (previewHour - 17) / 7;
  const moonX = 12 + (clamp(moonProgress, 0, 1) * 68);
  const moonY = 52 - (Math.sin(clamp(moonProgress, 0, 1) * Math.PI) * 32);

  return {
    skyTop,
    skyBottom,
    sunsetColor,
    fogColor,
    sunColor,
    sunGlowColor,
    moonColor,
    sunlightColor,
    waterTint,
    sunScale,
    moonScale,
    fogDensity,
    cloudLayers,
    daypart,
    nightFactor,
    sunVisible,
    moonVisible,
    sunX,
    sunY,
    moonX,
    moonY,
  };
}
