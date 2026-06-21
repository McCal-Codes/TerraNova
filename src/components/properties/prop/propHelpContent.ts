export const PROP_HELP_DOC_SLUG = "guides/content/props-and-placement";

export function getPropHelpContent() {
  return {
    title: "Props in TerraNova",
    summary:
      "Each Props tab is one placement layer: positions find XZ candidates, scanners pick Y, assignments place prefabs or imported definitions.",
    bullets: [
      "Runtime orders which prop pass runs (0 = first). Skip disables the layer without deleting it.",
      "PropDistribution wraps positions and assignments in one graph; flat Props keep them as separate roots.",
      "Use + Prop to start from a Hytale prefab, reference biome, Bridge world biome, or blank graph.",
      "Replace from Hytale swaps the current layer graph while keeping the tab index.",
      "3D prefab preview needs synced Hytale block assets for real textures.",
    ],
  };
}
