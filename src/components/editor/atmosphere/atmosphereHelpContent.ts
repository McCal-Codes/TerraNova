import type { AtmosphereEditorUIMode } from "@/stores/uiStore";

export type AtmosphereHelpContext =
  | "weather-editor"
  | "environment-editor"
  | "asset-inspector-weather"
  | "asset-inspector-environment"
  | "biome-atmosphere"
  | "sync-3d"
  | "forecast-strip"
  | "import-banner"
  | "parent-chain";

export interface AtmosphereHelpContent {
  title: string;
  summary: string;
  bullets: string[];
}

const SHARED_PREVIEW_HOUR =
  "Preview hour is shared everywhere: center editors, Asset Inspector scene preview, and the biome Atmosphere tab all use the same hour (0–23). Change it in one place and the others follow.";

const SIMPLE_ADVANCED: Record<AtmosphereEditorUIMode, string> = {
  simple:
    "Simple mode shows scene preview, quick edits, and the current hour only. Switch to Advanced for full tracks, bulk forecast tools, tags, and raw JSON fields.",
  advanced:
    "Advanced mode exposes every track and bulk tool. Switch to Simple when you only need preview + quick tuning.",
};

export const ATMOSPHERE_HELP_DOC_SLUG = "guides/world/environments-and-weather";

export function getAtmosphereHelpContent(
  context: AtmosphereHelpContext,
  editorUIMode: AtmosphereEditorUIMode = "simple",
): AtmosphereHelpContent {
  switch (context) {
    case "weather-editor":
      return {
        title: "Weather editor",
        summary: "Edit one weather JSON file — sky colors, fog, clouds, and celestial textures for a single look.",
        bullets: [
          SHARED_PREVIEW_HOUR,
          SIMPLE_ADVANCED[editorUIMode],
          "Quick Edit writes keyframes at the preview hour. The scene card samples those tracks (colors interpolate between hours).",
          "Use the right Asset Inspector to import missing Common/Sky textures. Use Advanced Issue Log for fog distance and default cloud layers.",
          "Sync 3D (Simple: under scene card; Advanced: toolbar) pushes this weather into the terrain 3D preview when enabled.",
        ],
      };
    case "environment-editor":
      return {
        title: "Environment editor",
        summary: "Route which weather runs at each hour. Environments inherit from Parent and reference weather IDs in Server/Weathers.",
        bullets: [
          SHARED_PREVIEW_HOUR,
          SIMPLE_ADVANCED[editorUIMode],
          "Scene preview shows the dominant weather at the selected hour (local forecast wins; empty hours inherit from Parent).",
          "Forecast strip colors come from resolved weather files — click an hour to preview it. Built-in weathers are not in your pack until you Import.",
          "Parent chain links open parent environment files. Issue Log (Advanced) or the import banner (Simple) materializes missing weathers.",
        ],
      };
    case "asset-inspector-weather":
      return {
        title: "Weather asset inspector",
        summary: "Side panel for the weather file open in the center editor.",
        bullets: [
          SHARED_PREVIEW_HOUR,
          "Scene Preview mirrors the center weather editor at the shared hour.",
          "Asset Tools lists sky textures (stars, moons, clouds). Import built-ins into Common/Sky before export.",
        ],
      };
    case "asset-inspector-environment":
      return {
        title: "Environment asset inspector",
        summary: "Side panel for the environment file open in the center editor.",
        bullets: [
          SHARED_PREVIEW_HOUR,
          "Scene Preview resolves Parent inheritance, then samples the dominant weather at the shared hour.",
          "Forecast strip matches the center environment editor. Asset Tools imports or creates referenced weather JSON files.",
        ],
      };
    case "biome-atmosphere":
      return {
        title: "Biome atmosphere tab",
        summary: "Tweak biome preview colors and see which environment/weather assets your biome resolves at each hour.",
        bullets: [
          SHARED_PREVIEW_HOUR,
          "Sky/Fog/Lighting sliders here affect the terrain preview directly (separate from weather JSON files).",
          "Forecast strip reads the environment from EnvironmentProvider — empty {} means the server default, not “no environment”.",
          "Use Refresh preview from assets after changing EnvironmentProvider or adding weather files. Open environment/weather files from the rows below.",
          "Tint: edit band colors and SimplexNoise2D noise here; expand Advanced for delimiter ranges or open the Tint graph for complex density proxies.",
        ],
      };
    case "sync-3d":
      return {
        title: "Sync 3D preview",
        summary: "Optional bridge from atmosphere editors into the terrain 3D preview panel.",
        bullets: [
          "Off by default. When on, resolved weather/environment colors update the 3D terrain preview.",
          "Does not change biome Atmosphere tab slider values unless you edit those separately.",
          "Turn off if the 3D preview fights manual Atmosphere tab tuning.",
        ],
      };
    case "forecast-strip":
      return {
        title: "Forecast strip",
        summary: "24-hour schedule of which weather is active each hour.",
        bullets: [
          "Each cell is colored from the dominant weather’s sky tracks at that hour.",
          "Dimmed cells use inherited forecasts from a Parent environment (child file left that hour empty).",
          "Click a cell to set the shared preview hour. Double-click to open the dominant weather JSON when it is indexed in Server/Weathers.",
        ],
      };
    case "import-banner":
      return {
        title: "Built-in weather references",
        summary: "Your environment references Hytale cache weathers that are not copied into the pack yet.",
        bullets: [
          "Built-in = resolved from synced Hytale assets, not from Server/Weathers in your project.",
          "Import built-in copies JSON into your pack so export and offline edits work.",
          "Advanced Issue Log has per-ID actions; Simple mode uses this banner for the same import.",
        ],
      };
    case "parent-chain":
      return {
        title: "Parent inheritance",
        summary: "Child environments override only what they define; other fields and empty forecast hours come from ancestors.",
        bullets: [
          "Set Parent to the family base (e.g. Env_Zone1), not a duplicate of this file.",
          "Click a name in the chain to open that environment JSON.",
          "Inherited hours show as info in the Issue Log, not errors, when the parent fills the schedule.",
        ],
      };
    default:
      return {
        title: "Atmosphere",
        summary: "Weather and environment authoring in TerraNova.",
        bullets: [SHARED_PREVIEW_HOUR],
      };
  }
}
