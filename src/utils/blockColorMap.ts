import { getMaterialProperties } from "./materialResolver";

/**
 * Maps Hytale block names (from the server palette) to rendering colors.
 * Strips "hytale:" prefix and uses keyword matching for common block types.
 */

export interface BlockRenderInfo {
  name: string;
  color: string;
  roughness: number;
  metalness: number;
}

const BLOCK_COLORS: Record<string, string> = {
  // Core terrain
  air: "#00000000",
  stone: "#909090",
  grass: "#5cb85c",
  dirt: "#a0724a",
  sand: "#d4c590",
  gravel: "#a0a0a0",
  bedrock: "#2a2a2a",
  cobblestone: "#7a7a7a",
  clay: "#b87333",
  // Rock variants
  granite: "#9e8b7e",
  slate: "#5c5c6e",
  limestone: "#c4b99a",
  basalt: "#3d3d3d",
  sandstone: "#d2b48c",
  marble: "#e0ddd5",
  quartzite: "#d6cec0",
  // Soil variants
  mud: "#6b4423",
  moss: "#4a7a4a",
  // Snow / Ice
  snow: "#e8e8f0",
  ice: "#b0e0e6",
  packed_ice: "#9dcad4",
  // Wood / Organic
  wood: "#8b6b4a",
  log: "#8b6b4a",
  planks: "#c4a870",
  leaves: "#3e8a3e",
  cactus: "#5c9e3e",
  // Fluids
  water: "#4169e1",
  lava: "#ff4500",
  // Ores / Special
  coal_ore: "#3a3a3a",
  iron_ore: "#b8916e",
  gold_ore: "#ffd700",
  // Vegetation
  tall_grass: "#5cb85c",
  flower: "#d63384",
  mushroom: "#c0392b",
  // ── Hytale V2 block names (lowercased, hytale: prefix stripped) ──
  // Rock family
  rock_stone: "#909090",
  rock_granite: "#9e8b7e",
  rock_basalt: "#3d3d3d",
  rock_slate: "#5c5c6e",
  rock_limestone: "#c4b99a",
  rock_sandstone: "#d2b48c",
  rock_marble: "#e0ddd5",
  rock_quartzite: "#d6cec0",
  rock_cobblestone: "#7a7a7a",
  // Soil family
  soil_dirt: "#a0724a",
  soil_grass: "#5cb85c",
  soil_grass_deep: "#4a8a4a",
  soil_mud: "#6b4423",
  soil_clay: "#b87333",
  soil_sand: "#d4c590",
  soil_gravel: "#a0a0a0",
  soil_moss: "#4a7a4a",
  // Wood family
  wood_oak: "#8b6b4a",
  wood_birch: "#c4a870",
  wood_pine: "#7a5c3a",
  wood_dark: "#5a3a2a",
  wood_driftwood: "#b0956e",
  // Foliage
  leaves_oak: "#3e8a3e",
  leaves_birch: "#5aa85a",
  leaves_pine: "#2e6e2e",
  // Fluid blocks
  fluid_water: "#4169e1",
  fluid_lava: "#ff4500",
  // Desert / arid biome blocks
  soil_clay_yellow: "#d4a870",
  soil_gravel_sand: "#c8b87c",
  soil_sand_white: "#ece0c4",
  rock_sandstone_white: "#ece0c8",
  plant_leaves_dry: "#8a7055",
  plant_cactus: "#5c9e3e",
  plant_bush: "#5a8040",
  plant_grass_tall: "#6aaa55",
  plant_reed: "#8a9a60",
  plant_mushroom: "#c0392b",
  plant_flower: "#e83d84",
  wood_dry_trunk: "#7a5c3a",
  wood_dry_trunk_full: "#7a5c3a",
  wood_dry_branch_long: "#8b6845",
  wood_sticks: "#9a7855",
  // Snow / Ice family
  snow_powder: "#e8e8f0",
  snow_packed: "#d8d8e8",
  ice_thin: "#b0e0e6",
  ice_packed: "#9dcad4",
  // McCals-WorldGen (Testing New Worldgen 3 — Zone1 forest)
  rock_crystal_pink_medium: "#e8a0c0",
  rock_stone_cobble: "#7a7a7a",
  rock_stone_mossy: "#607060",
  rock_stone_stalactite_large: "#888888",
  ore_copper_stone: "#c8743a",
  wood_hardwood_planks: "#7a5040",
  wood_hardwood_planks_half: "#7a5040",
  wood_maple_trunk: "#8b4e2a",
  wood_maple_trunk_full: "#8b4e2a",
  wood_maple_branch_long: "#9a5a34",
  wood_maple_branch_short: "#9a5a34",
  wood_maple_branch_corner: "#9a5a34",
  wood_aspen_trunk: "#c8c0a8",
  wood_aspen_trunk_full: "#c8c0a8",
  wood_aspen_branch_long: "#c0b89a",
  wood_aspen_branch_short: "#c0b89a",
  wood_aspen_branch_corner: "#c0b89a",
  plant_fern_forest: "#4a8040",
  plant_fern_winter: "#8a9070",
  plant_bush_arid_red: "#7a3020",
  plant_bush_lush: "#3a7030",
  plant_bush_winter: "#a0a880",
  plant_grass_lush: "#5cb85c",
  plant_grass_lush_short: "#62bc62",
  plant_grass_lush_tall: "#5a9a5a",
  plant_grass_sharp_short: "#70a060",
  plant_grass_sharp_tall: "#5a9040",
  plant_leaves_maple: "#c8802a",
  plant_leaves_aspen: "#e8c84a",
  plant_moss_block_green: "#4a8a3a",
  plant_moss_green: "#5a9040",
  plant_moss_short_green: "#5a9040",
  plant_moss_cave_green: "#2a5a30",
  plant_moss_wall_green: "#3a7030",
  plant_crop_mushroom_glowing_orange: "#f07820",
  plant_crop_mushroom_cap_red: "#c03020",
  plant_crop_mushroom_cap_brown: "#8b5030",
  plant_crop_mushroom_block_brown: "#7a4828",
  plant_crop_mushroom_shelve_brown: "#8b5030",
  plant_crop_health1: "#e84060",
  soil_mud_dry: "#8a6040",
  soil_leaves: "#7a6a40",
  deco_lantern: "#e8c040",
  furniture_lumberjack_shelf: "#9a7050",
  furniture_lumberjack_lantern: "#e8a020",
  furniture_village_bookcase: "#9a7050",
  furniture_village_bed: "#b87060",
  furniture_village_shelf_full: "#9a7050",
};

/** Keyword → color fallback for blocks not in the exact lookup */
const KEYWORD_COLORS: [string, string][] = [
  ["lava", "#ff4500"],
  ["magma", "#b22222"],
  ["water", "#4169e1"],
  ["ice", "#b0e0e6"],
  ["snow", "#e8e8f0"],
  ["stone", "#909090"],
  ["rock", "#909090"],
  ["granite", "#9e8b7e"],
  ["slate", "#5c5c6e"],
  ["basalt", "#3d3d3d"],
  ["limestone", "#c4b99a"],
  ["sandstone", "#d2b48c"],
  ["marble", "#e0ddd5"],
  ["grass", "#5cb85c"],
  ["dirt", "#a0724a"],
  ["soil", "#a0724a"],
  ["mud", "#6b4423"],
  ["clay", "#b87333"],
  ["sand", "#d4c590"],
  ["gravel", "#a0a0a0"],
  ["moss", "#4a7a4a"],
  ["wood", "#8b6b4a"],
  ["log", "#8b6b4a"],
  ["plank", "#c4a870"],
  ["leaves", "#3e8a3e"],
  ["leaf", "#3e8a3e"],
  ["bedrock", "#2a2a2a"],
  ["cobble", "#7a7a7a"],
  ["ore", "#908070"],
  ["crystal", "#88ccee"],
  ["glass", "#c0e8ff"],
  ["plant", "#5a9040"],
  ["fern", "#4a8040"],
  ["bush", "#3a7030"],
  ["crop", "#6aaa55"],
  ["furniture", "#9a7050"],
  ["deco", "#c8a844"],
  ["mushroom", "#8b5030"],
];

/**
 * Resolve a block name from the server palette to a render color and PBR properties.
 * Strips "hytale:" prefix, normalizes to lowercase.
 */
export function resolveBlockColor(rawName: string): BlockRenderInfo {
  // Strip namespace prefix
  const name = rawName.replace(/^hytale:/, "").toLowerCase();

  // Exact match
  if (BLOCK_COLORS[name]) {
    const pbr = getMaterialProperties(name);
    return {
      name,
      color: BLOCK_COLORS[name],
      roughness: pbr.roughness ?? 0.8,
      metalness: pbr.metalness ?? 0.0,
    };
  }

  // Keyword match
  for (const [keyword, color] of KEYWORD_COLORS) {
    if (name.includes(keyword)) {
      const pbr = getMaterialProperties(keyword);
      return {
        name,
        color,
        roughness: pbr.roughness ?? 0.8,
        metalness: pbr.metalness ?? 0.0,
      };
    }
  }

  // Unknown block — gray
  return { name, color: "#808080", roughness: 0.8, metalness: 0.0 };
}
