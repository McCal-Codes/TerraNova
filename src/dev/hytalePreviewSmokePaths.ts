/** Release Hytale biomes used for cave/river/PCN preview smoke (synced hytale-assets cache). */

export const HYTALE_SMOKE_BIOMES = {

  exampleCellNoise2D: "Server/HytaleGenerator/Biomes/Examples/Example_CellNoise2D.json",

  generativeArches: "Server/HytaleGenerator/Biomes/Generative/Generative_Arches.json",

  generativeVeins: "Server/HytaleGenerator/Biomes/Generative/Generative_Veins.json",

  plains1River: "Server/HytaleGenerator/Biomes/Plains1/Plains1_River.json",

  plains1Deeproot: "Server/HytaleGenerator/Biomes/Plains1/Plains1_Deeproot.json",

  desert1River: "Server/HytaleGenerator/Biomes/Desert1/Desert1_River.json",

  desert1Stacks: "Server/HytaleGenerator/Biomes/Desert1/Desert1_Stacks.json",

  testFeatures: "Server/HytaleGenerator/Biomes/Test_Features.json",

} as const;



export type HytaleSmokeBiomeId = keyof typeof HYTALE_SMOKE_BIOMES;

/** Smoke biomes that have a DEV shape-preview gallery case. */
export type HytaleGallerySmokeBiomeId =
  | "exampleCellNoise2D"
  | "generativeArches"
  | "generativeVeins"
  | "plains1River"
  | "plains1Deeproot"
  | "testFeatures";

