import type { AtmosphereSettings } from "@/stores/previewStore";
import type { DirectoryEntryData } from "@/utils/ipc";
import { listDirectory, resolveBundledHytaleAssetPath } from "@/utils/ipc";
import { joinPath } from "@/utils/pathUtils";
import { normalizeColorToken, sampleColorAtHour } from "./colorTracks";
import { toFiniteNumber, type JsonRecord } from "./jsonUtils";

export const FALLBACK_ATMOSPHERE_SETTINGS: AtmosphereSettings = {
  skyHorizon: "#8fd8f8",
  skyZenith: "#077ddd",
  sunsetColor: "#ffb951",
  sunGlowColor: "#ffffff",
  cloudDensity: 0.3,
  fogColor: "#8fd8f8",
  fogNear: -96,
  fogFar: 1024,
  ambientColor: "#6080a0",
  sunColor: "#ffffff",
  waterTint: "#1983d9",
  sunAngle: 60,
};

function parseFogDistance(fogDistance: unknown): [number, number] | null {
  if (!Array.isArray(fogDistance) || fogDistance.length < 2) return null;
  const near = toFiniteNumber(fogDistance[0]);
  const far = toFiniteNumber(fogDistance[1]);
  if (near === null || far === null) return null;
  return [near, far];
}

function clampByte(value: number): number {
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.slice(1);
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  const [r, g, b] = rgb.map(clampByte) as [number, number, number];
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function blendHexColors(a: string, b: string, t: number): string {
  const clampedT = Math.max(0, Math.min(1, t));
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([
    ar + (br - ar) * clampedT,
    ag + (bg - ag) * clampedT,
    ab + (bb - ab) * clampedT,
  ]);
}

function scaleHexColor(hex: string, scale: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r * scale, g * scale, b * scale]);
}

function deriveAmbientColor(
  sunColor: string,
  fogColor: string,
  skyHorizon: string,
): string {
  const fogSkyMix = blendHexColors(fogColor, skyHorizon, 0.5);
  const litMix = blendHexColors(fogSkyMix, sunColor, 0.35);
  return scaleHexColor(litMix, 0.75);
}

export function buildAtmosphereSettings(
  environment: JsonRecord | null,
  weather: JsonRecord | null,
  hour: number,
): AtmosphereSettings {
  const skyHorizon =
    sampleColorAtHour(weather?.SkyBottomColors, hour) ??
    FALLBACK_ATMOSPHERE_SETTINGS.skyHorizon;
  const skyZenith =
    sampleColorAtHour(weather?.SkyTopColors, hour) ??
    FALLBACK_ATMOSPHERE_SETTINGS.skyZenith;
  const sunsetColor =
    sampleColorAtHour(weather?.SkySunsetColors, hour) ??
    FALLBACK_ATMOSPHERE_SETTINGS.sunsetColor;
  const fogColor =
    sampleColorAtHour(weather?.FogColors, hour) ??
    skyHorizon;
  const sunColor =
    sampleColorAtHour(weather?.SunColors, hour) ??
    FALLBACK_ATMOSPHERE_SETTINGS.sunColor;
  const sunGlowColor =
    sampleColorAtHour(weather?.SunGlowColors, hour) ??
    sunColor;

  const sunlightColor = sampleColorAtHour(weather?.SunlightColors, hour);
  const ambientColor = sunlightColor ?? deriveAmbientColor(sunColor, fogColor, skyHorizon);

  const waterTint =
    sampleColorAtHour(weather?.WaterTints, hour) ??
    normalizeColorToken(weather?.WaterTint) ??
    normalizeColorToken(environment?.WaterTint) ??
    FALLBACK_ATMOSPHERE_SETTINGS.waterTint;

  const fogDistance = parseFogDistance(weather?.FogDistance);
  const fogNear = fogDistance?.[0] ?? FALLBACK_ATMOSPHERE_SETTINGS.fogNear;
  const fogFar = fogDistance?.[1] ?? FALLBACK_ATMOSPHERE_SETTINGS.fogFar;

  return {
    skyHorizon,
    skyZenith,
    sunsetColor,
    sunGlowColor,
    cloudDensity: FALLBACK_ATMOSPHERE_SETTINGS.cloudDensity,
    fogColor,
    fogNear,
    fogFar,
    ambientColor,
    sunColor,
    waterTint,
    sunAngle: ((hour - 6 + 24) % 24) * (180 / 24),
  };
}

export function sampleWeatherSkyGradient(
  weather: JsonRecord | null,
  hour: number,
): { top: string; bottom: string } {
  return {
    top: sampleColorAtHour(weather?.SkyTopColors, hour) ?? "#28405a",
    bottom: sampleColorAtHour(weather?.SkyBottomColors, hour) ?? "#0f172a",
  };
}

function collectJsonFiles(entries: DirectoryEntryData[]): Array<{ id: string; path: string }> {
  const files: Array<{ id: string; path: string }> = [];

  const visit = (items: DirectoryEntryData[]) => {
    for (const entry of items) {
      if (entry.is_dir && entry.children) {
        visit(entry.children);
        continue;
      }
      if (!entry.is_dir && entry.name.toLowerCase().endsWith(".json")) {
        files.push({
          id: entry.name.replace(/\.json$/i, ""),
          path: entry.path,
        });
      }
    }
  };

  visit(entries);
  return files;
}

export interface WeatherAssetIndexResult {
  options: Array<{ id: string; path: string }>;
  pathIndex: Record<string, string>;
  projectWeathersFound: boolean;
  bundledCount: number;
}

export async function scanWeatherAssetIndex(
  serverRoot: string | null,
): Promise<WeatherAssetIndexResult> {
  const allFiles: Array<{ id: string; path: string }> = [];
  let projectWeathersFound = false;
  let bundledCount = 0;

  if (serverRoot) {
    try {
      const entries = await listDirectory(joinPath(serverRoot, "Weathers"));
      allFiles.push(...collectJsonFiles(entries));
      projectWeathersFound = true;
    } catch {
      // fall through to bundled assets
    }
  }

  try {
    const bundledWeathersPath = await resolveBundledHytaleAssetPath("Server/Weathers");
    const bundledEntries = await listDirectory(bundledWeathersPath);
    const bundledFiles = collectJsonFiles(bundledEntries);
    bundledCount = bundledFiles.length;
    allFiles.push(...bundledFiles);
  } catch {
    // bundled assets optional
  }

  const pathIndex: Record<string, string> = {};
  const seen = new Set<string>();
  const deduped: Array<{ id: string; path: string }> = [];
  for (const file of allFiles) {
    const key = file.id.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(file);
      pathIndex[key] = file.path;
    }
  }

  deduped.sort((left, right) => left.id.localeCompare(right.id));
  return {
    options: deduped,
    pathIndex,
    projectWeathersFound,
    bundledCount,
  };
}

export { isPathInProject } from "@/utils/pathUtils";
