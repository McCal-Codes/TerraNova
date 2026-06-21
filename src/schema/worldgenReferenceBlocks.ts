import { getDefaults } from "@/schema/defaults";
import type { SnippetDefinition } from "@/schema/snippets";

/**
 * Curated worldgen reference blocks composed from existing TerraNova/Hytale nodes.
 * These are macro/template insertions (not first-class evaluator/schema node types).
 */
export const WORLDGEN_REFERENCE_BLOCKS: SnippetDefinition[] = [
  {
    id: "desert-river-carve-module",
    name: "Desert River Carve Module",
    description: "River-biased carve branch for desert terrain channels and gullies.",
    category: "Worldgen References",
    library: "worldgen-reference",
    sourceRefs: [
      "Hytale release: Desert1_River",
    ],
    tags: ["desert", "river", "ravine"],
    nodes: [
      {
        localId: "terrainNoise",
        type: "SimplexNoise2D",
        displayType: "SimplexNoise2D",
        fields: { ...getDefaults("SimplexNoise2D"), Scale: 95, Seed: "DesertRiverA", Octaves: 2 },
        offsetX: 0,
        offsetY: 0,
      },
      {
        localId: "riverMask",
        type: "CurveMapper",
        displayType: "CurveMapper",
        fields: {},
        offsetX: 300,
        offsetY: 0,
      },
      {
        localId: "riverCurve",
        type: "Curve:Manual",
        displayType: "Curve:Manual",
        fields: {
          Points: [
            { In: -1, Out: 1 },
            { In: -0.08, Out: 0.85 },
            { In: 0.06, Out: -0.4 },
            { In: 1, Out: -1 },
          ],
        },
        offsetX: 300,
        offsetY: -150,
      },
      {
        localId: "invert",
        type: "Inverter",
        displayType: "Inverter",
        fields: {},
        offsetX: 560,
        offsetY: 0,
      },
      {
        localId: "smoothClamp",
        type: "SmoothClamp",
        displayType: "SmoothClamp",
        fields: { ...getDefaults("SmoothClamp"), WallA: -0.7, WallB: 0.25 },
        offsetX: 830,
        offsetY: 0,
      },
    ],
    edges: [
      { sourceLocal: "terrainNoise", targetLocal: "riverMask", targetHandle: "Input" },
      { sourceLocal: "riverCurve", targetLocal: "riverMask", targetHandle: "Curve" },
      { sourceLocal: "riverMask", targetLocal: "invert", targetHandle: "Input" },
      { sourceLocal: "invert", targetLocal: "smoothClamp", targetHandle: "Input" },
    ],
  },
  {
    id: "skyreach-ravine-3d-carve",
    name: "Skyreach Ravine 3D Carve",
    description: "SimplexNoise3D-based ravine carving branch tuned for deep crevices. Full Skyreach Ravines v3.6 also uses YSampled+Cache stacks, Pow(3) rib walls, and height-delimited EnvironmentProvider — see src/docs/reference/community-pack-references.md.",
    category: "Worldgen References",
    library: "worldgen-reference",
    sourceRefs: [
      "Worldgen Mods: Skyreach Ravines v3.6 (reference)",
    ],
    tags: ["skyreach", "ravine", "simplex3d", "cave"],
    nodes: [
      {
        localId: "noise3d",
        type: "SimplexNoise3D",
        displayType: "SimplexNoise3D",
        fields: { ...getDefaults("SimplexNoise3D"), Scale: 0.045, Octaves: 2, Seed: "SkyreachRavines" },
        offsetX: 0,
        offsetY: 0,
      },
      {
        localId: "invert",
        type: "Inverter",
        displayType: "Inverter",
        fields: {},
        offsetX: 260,
        offsetY: 0,
      },
      {
        localId: "clamp",
        type: "SmoothClamp",
        displayType: "SmoothClamp",
        fields: { ...getDefaults("SmoothClamp"), WallA: -0.95, WallB: 0.25 },
        offsetX: 520,
        offsetY: 0,
      },
      {
        localId: "blendNoise",
        type: "SimplexNoise2D",
        displayType: "SimplexNoise2D",
        fields: { ...getDefaults("SimplexNoise2D"), Scale: 140, Octaves: 1, Seed: "SkyreachMask" },
        offsetX: 520,
        offsetY: 180,
      },
      {
        localId: "mix",
        type: "Mix",
        displayType: "Mix",
        fields: {},
        offsetX: 790,
        offsetY: 70,
      },
    ],
    edges: [
      { sourceLocal: "noise3d", targetLocal: "invert", targetHandle: "Input" },
      { sourceLocal: "invert", targetLocal: "clamp", targetHandle: "Input" },
      { sourceLocal: "clamp", targetLocal: "mix", targetHandle: "InputA" },
      { sourceLocal: "blendNoise", targetLocal: "mix", targetHandle: "InputB" },
      { sourceLocal: "blendNoise", targetLocal: "mix", targetHandle: "Factor" },
    ],
  },
  {
    id: "sky-island-altitude-band",
    name: "Sky Island Altitude Band",
    description: "BaseHeight distance band + 3D noise for floating island layers.",
    category: "Worldgen References",
    library: "worldgen-reference",
    sourceRefs: [
      "Hytale style: altitude-banded sky islands",
    ],
    tags: ["sky-islands", "band", "baseheight", "simplex3d"],
    nodes: [
      {
        localId: "baseHeight",
        type: "BaseHeight",
        displayType: "BaseHeight",
        fields: { ...getDefaults("BaseHeight"), BaseHeightName: "Base", Distance: true },
        offsetX: 0,
        offsetY: 0,
      },
      {
        localId: "bandCurve",
        type: "CurveMapper",
        displayType: "CurveMapper",
        fields: {},
        offsetX: 300,
        offsetY: 0,
      },
      {
        localId: "manualBand",
        type: "Curve:Manual",
        displayType: "Curve:Manual",
        fields: {
          Points: [
            { In: 0, Out: -1 },
            { In: 75, Out: -1 },
            { In: 110, Out: 1 },
            { In: 145, Out: -1 },
            { In: 220, Out: -1 },
          ],
        },
        offsetX: 300,
        offsetY: -150,
      },
      {
        localId: "islandNoise3d",
        type: "SimplexNoise3D",
        displayType: "SimplexNoise3D",
        fields: { ...getDefaults("SimplexNoise3D"), Scale: 0.03, Octaves: 2, Seed: "SkyIslandA" },
        offsetX: 300,
        offsetY: 180,
      },
      {
        localId: "sum",
        type: "Sum",
        displayType: "Sum",
        fields: {},
        offsetX: 610,
        offsetY: 75,
      },
      {
        localId: "normalize",
        type: "Normalizer",
        displayType: "Normalizer",
        fields: { ...getDefaults("Normalizer"), FromMin: -2, FromMax: 2, ToMin: -1, ToMax: 1 },
        offsetX: 890,
        offsetY: 75,
      },
    ],
    edges: [
      { sourceLocal: "baseHeight", targetLocal: "bandCurve", targetHandle: "Input" },
      { sourceLocal: "manualBand", targetLocal: "bandCurve", targetHandle: "Curve" },
      { sourceLocal: "bandCurve", targetLocal: "sum", targetHandle: "Inputs[0]" },
      { sourceLocal: "islandNoise3d", targetLocal: "sum", targetHandle: "Inputs[1]" },
      { sourceLocal: "sum", targetLocal: "normalize", targetHandle: "Input" },
    ],
  },
];

