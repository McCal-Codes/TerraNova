import type { HourColor, HourValue } from "@/utils/atmosphere";
import { ATMOSPHERE_HOURS } from "@/utils/atmosphere/atmosphereHours";

export interface CloudLayer {
  Texture?: string;
  Colors?: HourColor[];
  Speeds?: HourValue[];
}

export interface MoonEntry {
  Day?: number;
  Texture?: string;
}

export interface WeatherDoc extends Record<string, unknown> {
  Stars?: string;
  Moons?: MoonEntry[];
  Clouds?: CloudLayer[];
  Particle?: unknown;
  FogDistance?: [number, number];
  Tags?: Record<string, string[]>;
}

export const HOURS = ATMOSPHERE_HOURS;

export const COLOR_TRACKS = [
  { key: "SkyTopColors", label: "Sky Top" },
  { key: "SkyBottomColors", label: "Sky Bottom" },
  { key: "SkySunsetColors", label: "Sunset" },
  { key: "FogColors", label: "Fog" },
  { key: "SunColors", label: "Sun" },
  { key: "SunGlowColors", label: "Sun Glow" },
  { key: "MoonColors", label: "Moon" },
  { key: "MoonGlowColors", label: "Moon Glow" },
  { key: "SunlightColors", label: "Sunlight" },
  { key: "ScreenEffectColors", label: "Screen FX" },
  { key: "WaterTints", label: "Water" },
] as const;

export const VALUE_TRACKS = [
  { key: "SunScales", label: "Sun Scale" },
  { key: "MoonScales", label: "Moon Scale" },
  { key: "FogDensities", label: "Fog Density" },
  { key: "FogHeightFalloffs", label: "Fog Height Falloff" },
  { key: "SunlightDampingMultipliers", label: "Sunlight Damping" },
] as const;

export const KNOWN_KEYS = new Set<string>([
  ...COLOR_TRACKS.map((track) => track.key),
  ...VALUE_TRACKS.map((track) => track.key),
  "Stars",
  "Moons",
  "Clouds",
  "FogDistance",
  "Particle",
  "FogOptions",
  "ColorFilters",
  "ScreenEffect",
  "Parent",
  "Tags",
  "$Comment",
]);

export type ColorTrackKey = (typeof COLOR_TRACKS)[number]["key"];
export type ValueTrackKey = (typeof VALUE_TRACKS)[number]["key"];

export interface BundledAssetSource {
  bundledPath: string;
  referencePath: string;
}

export const DEFAULT_CELESTIAL_ASSETS: BundledAssetSource[] = [
  { bundledPath: "Common/Sky/Stars.png", referencePath: "Sky/Stars.png" },
  { bundledPath: "Common/Sky/MoonCycle/Moon_Full.png", referencePath: "Sky/MoonCycle/Moon_Full.png" },
  { bundledPath: "Common/Sky/MoonCycle/Moon_Gibbous.png", referencePath: "Sky/MoonCycle/Moon_Gibbous.png" },
  { bundledPath: "Common/Sky/MoonCycle/Moon_Half.png", referencePath: "Sky/MoonCycle/Moon_Half.png" },
  { bundledPath: "Common/Sky/MoonCycle/Moon_Crescent.png", referencePath: "Sky/MoonCycle/Moon_Crescent.png" },
  { bundledPath: "Common/Sky/MoonCycle/Moon_New.png", referencePath: "Sky/MoonCycle/Moon_New.png" },
];

export const DEFAULT_CLOUD_ASSETS: BundledAssetSource[] = [
  { bundledPath: "Common/Sky/Clouds/Light_Base.png", referencePath: "Sky/Clouds/Light_Base.png" },
  { bundledPath: "Common/Sky/Clouds/Light_Highlights.png", referencePath: "Sky/Clouds/Light_Highlights.png" },
];
