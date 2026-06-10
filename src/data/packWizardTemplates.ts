import type { PackWizardBundleTemplate } from "@/utils/ipc";

export interface PackWizardTemplateOption {
  id: string;
  displayName: string;
  description: string;
  /** Bundled template folder name, or empty for inline/basic */
  templateFolder?: string;
  /** Relative path under Server/HytaleGenerator for file copy */
  sourceRelativePath?: string;
}

/** Inline wizard biome — rolling hills generated in Rust (not a flat void slab). */
export const BASIC_BIOME_TEMPLATE: PackWizardTemplateOption = {
  id: "basic",
  displayName: "Simple Hills",
  description: "Gentle rolling hills with grass tint and a configurable surface block.",
};

export function bundleToWizardOption(bundle: PackWizardBundleTemplate): PackWizardTemplateOption {
  return {
    id: bundle.id,
    displayName: bundle.displayName,
    description: bundle.description,
    templateFolder: bundle.id,
    sourceRelativePath: `Server/HytaleGenerator/${bundle.biomeRelativePath}`,
  };
}

/** @deprecated Use usePackWizardBundleTemplates() — kept for tests and fallbacks. */
export const WORLD_STRUCTURE_TEMPLATES: PackWizardTemplateOption[] = [
  BASIC_BIOME_TEMPLATE,
  {
    id: "void",
    displayName: "Void",
    description: "Minimal flat world structure from the Void starter template.",
    templateFolder: "void",
    sourceRelativePath: "Server/HytaleGenerator/WorldStructures/MainWorld.json",
  },
  {
    id: "forest-hills",
    displayName: "Forest Hills",
    description: "Rolling-hills world structure from the Forest Hills template.",
    templateFolder: "forest-hills",
    sourceRelativePath: "Server/HytaleGenerator/WorldStructures/MainWorld.json",
  },
];

/** @deprecated Use usePackWizardBundleTemplates() — kept for tests and fallbacks. */
export const BIOME_TEMPLATES: PackWizardTemplateOption[] = [
  BASIC_BIOME_TEMPLATE,
  {
    id: "void",
    displayName: "Void",
    description: "Minimal flat biome from the Void starter template.",
    templateFolder: "void",
    sourceRelativePath: "Server/HytaleGenerator/Biomes/VoidBiome.json",
  },
  {
    id: "forest-hills",
    displayName: "Forest Hills",
    description: "Rolling hills with material bands and optional cave networks.",
    templateFolder: "forest-hills",
    sourceRelativePath: "Server/HytaleGenerator/Biomes/ForestHillsBiome.json",
  },
];

/** Reference biomes exported from Hytale's native editor. */
export const REFERENCE_BIOME_TEMPLATES: PackWizardTemplateOption[] = [
  { id: "reference:HiveWorld", displayName: "Hive World", description: "Hytale reference export.", templateFolder: "references", sourceRelativePath: "HiveWorld.json" },
  { id: "reference:Mudcracks_Actual_WIP_11", displayName: "Mudcracks", description: "Hytale reference export.", templateFolder: "references", sourceRelativePath: "Mudcracks_Actual_WIP_11.json" },
  { id: "reference:Tropical_Pirate_Islands", displayName: "Tropical Pirate Islands", description: "Hytale reference export.", templateFolder: "references", sourceRelativePath: "Tropical_Pirate_Islands.json" },
  { id: "reference:Lycheesis_Terrain_01", displayName: "Lycheesis Terrain", description: "Hytale reference export.", templateFolder: "references", sourceRelativePath: "Lycheesis_Terrain_01.json" },
  { id: "reference:ParkourPancakes", displayName: "Parkour Pancakes", description: "Hytale reference export.", templateFolder: "references", sourceRelativePath: "ParkourPancakes.json" },
  { id: "reference:Salt_Flats", displayName: "Salt Flats", description: "Hytale reference export.", templateFolder: "references", sourceRelativePath: "Salt_Flats.json" },
  { id: "reference:TheUnderworld", displayName: "The Underworld", description: "Hytale reference export.", templateFolder: "references", sourceRelativePath: "TheUnderworld.json" },
  { id: "reference:TwistWorldBiome", displayName: "Twist World", description: "Hytale reference export.", templateFolder: "references", sourceRelativePath: "TwistWorldBiome.json" },
];

export const ALL_BIOME_TEMPLATES = [...BIOME_TEMPLATES, ...REFERENCE_BIOME_TEMPLATES];

export type AtmosphereMode = "default" | "custom" | "import";

export interface PackWizardFormState {
  packGroup: string;
  packName: string;
  targetDir: string;
  worldStructureTemplate: string;
  biomeName: string;
  biomeTemplate: string;
  includeStarterProps: boolean;
  /** Optional Hytale prefab path (e.g. props/trees/oak_large) — Advanced wizard. */
  starterPrefabPath: string;
  /** Block ID for basic template MaterialProvider override (e.g. Rock_Stone). */
  primaryMaterialBlockId: string;
  atmosphereMode: AtmosphereMode;
  atmosphereImportId: string;
  instanceName: string;
  gameMode: string;
}

export const DEFAULT_PACK_WIZARD_STATE: PackWizardFormState = {
  packGroup: "User",
  packName: "MyPack",
  targetDir: "",
  worldStructureTemplate: "basic",
  biomeName: "MyBiome",
  biomeTemplate: "basic",
  includeStarterProps: false,
  starterPrefabPath: "",
  primaryMaterialBlockId: "Rock_Stone",
  atmosphereMode: "default",
  atmosphereImportId: "Env_Zone1_Forests",
  instanceName: "DefaultInstance",
  gameMode: "Creative",
};

/** Safe biome / instance identifier for filenames and JSON Name fields. */
export function slugifyPackIdentifier(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Unnamed";
  const cleaned = trimmed.replace(/[^\w]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (!cleaned) return "Unnamed";
  if (/^\d/.test(cleaned)) return `Biome_${cleaned}`;
  return cleaned;
}

/** Hytale mod Name field: hyphenated id from display name. */
export function slugifyHytaleModName(value: string): string {
  return value
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "My-Pack";
}

export function resolveBiomeTemplate(id: string): PackWizardTemplateOption | undefined {
  return ALL_BIOME_TEMPLATES.find((t) => t.id === id);
}

export function isReferenceBiomeTemplate(id: string): boolean {
  return id.startsWith("reference:");
}

/** Bundled templates that ship prop nodes in their biome JSON. */
const TEMPLATES_WITH_STARTER_PROPS = new Set([
  "forest-hills",
  "eldritch-spirelands",
  "shattered-archipelago",
  "tropical-pirate-islands",
]);

export function biomeTemplateIncludesStarterProps(id: string): boolean {
  return TEMPLATES_WITH_STARTER_PROPS.has(id);
}

/** When picking a bundled biome, pair the matching world structure folder. */
export function pairedWorldStructureForBiome(biomeTemplateId: string): string | null {
  if (biomeTemplateId === "basic") return "basic";
  if (biomeTemplateId.startsWith("reference:")) return null;
  return biomeTemplateId;
}

export function resolveWorldStructureTemplate(id: string): PackWizardTemplateOption | undefined {
  return WORLD_STRUCTURE_TEMPLATES.find((t) => t.id === id);
}

export function buildProjectPath(targetDir: string, packName: string): string {
  const folder = slugifyPackIdentifier(packName);
  const sep = targetDir.includes("\\") ? "\\" : "/";
  return `${targetDir.replace(/[/\\]+$/, "")}${sep}${folder}`;
}
