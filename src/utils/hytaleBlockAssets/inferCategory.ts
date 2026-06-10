/** Infer block category from Hytale block id (viewer fallback when no block_properties). */
export function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (n === "empty") return "other";
  if (n.startsWith("*")) return "other";
  if (n.includes("_roof_flat") || n.includes("_roof_hollow")) return "roof_flat";
  if (n.includes("_roof")) return "roof";
  if (n.includes("_stairs")) return "stairs";
  if (n.includes("_half")) return "half_slab";
  if (n.includes("_wall")) return "wall_block";
  if (n.includes("_pillar")) return "pillar";
  if (n.includes("_fence")) return "fence";
  if (n.includes("_beam")) return "beam";
  if (n.includes("_ladder")) return "ladder";
  if (
    n.includes("furniture_") || n.includes("_door") || n.includes("_bed")
    || n.includes("_torch") || n.includes("_lantern") || n.includes("_candle")
    || n.includes("_brazier") || n.includes("_bookshelf") || n.includes("_table")
    || n.includes("_chair") || n.includes("_shelf") || n.includes("_window")
  ) return "furniture";
  if (n.includes("vine_") || n.includes("_vine")) return "vine";
  if (n.includes("plant_") || n.includes("_moss") || n.includes("_flower")) return "plant";
  if (n.includes("crystal_")) return "crystal";
  if (
    n.includes("_cobble") || n.includes("_brick") || n.includes("_stone")
    || n.includes("_basalt") || n.includes("_shale") || n.includes("_sandstone")
    || n.includes("_volcanic") || n.includes("_limestone") || n.includes("_marble")
  ) return "solid_rock";
  if (n.includes("wood_") || n.includes("_planks")) return "solid_planks";
  if (
    n.includes("soil_") || n.includes("_dirt") || n.includes("_sand")
    || n.includes("_snow") || n.includes("_clay") || n.includes("_gravel")
  ) return "solid_soil";
  if (n.includes("_trunk")) return "tree_trunk";
  if (n.includes("leaves_") || n.includes("_leaves")) return "leaves";
  if (n.includes("mushroom_")) return "mushroom";
  if (n.includes("_stalactite")) return "stalactite";
  return "other";
}

export const CATEGORY_COLORS: Record<string, number> = {
  solid_rock: 0x888888,
  solid_planks: 0x8b6914,
  solid_soil: 0x6b4423,
  tree_trunk: 0x5c4033,
  leaves: 0x2d5016,
  plant: 0x3a7d2a,
  furniture: 0x9a7b4f,
  fence: 0x777777,
  wall_block: 0x777777,
  roof: 0x666666,
  roof_flat: 0x666666,
  stairs: 0x777777,
  half_slab: 0x777777,
  pillar: 0x888888,
  ladder: 0x8b6914,
  crystal: 0x88ccff,
  mushroom: 0xc4a882,
  vine: 0x2d5016,
  stalactite: 0x999999,
  other: 0x888888,
};

export function categoryColor(category: string): number {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
}
