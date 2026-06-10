/** Curated prefab paths for Create Pack — verified against common Hytale release layouts. */

export interface StarterPrefabSuggestion {
  id: string;
  label: string;
  path: string;
  hint?: string;
}

export const STARTER_PREFAB_SUGGESTIONS: StarterPrefabSuggestion[] = [
  {
    id: "palm",
    label: "Palm tree (green)",
    path: "Trees/Palm_Green/Stage_2",
    hint: "Tropical / pirate island biomes",
  },
  {
    id: "autumn-tree",
    label: "Autumn tree",
    path: "Trees/Autumn",
    hint: "Forest hills starter",
  },
  {
    id: "rock-volcanic",
    label: "Small volcanic rock cluster",
    path: "Rock_Formations/Rocks/Volcanic/Lava_Lakes_Small_Crystal",
    hint: "Surface rock accent",
  },
  {
    id: "monument-ruin",
    label: "Sandstone ruin node",
    path: "Monuments/Ruins/Sandstone/Surface/Straight_001",
    hint: "Landmark prop — pick a subfolder if this path is missing after sync",
  },
];
