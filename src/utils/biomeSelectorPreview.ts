import type { Node, Edge } from "@xyflow/react";
import type { BiomeRangeEntry } from "@/stores/slices/types";
import { evaluateDensityGrid } from "@/utils/density/evaluateGrid";
import { resolveBiomeAt, resolveBiomeIndexAt } from "@/utils/biomeRangeDomain";
import { biomeColor } from "@/utils/biomeRangeColors";

export interface BiomeSelectorMapResult {
  width: number;
  height: number;
  /** Biome index per pixel, -1 = default / unassigned */
  biomeIndices: Int16Array;
  /** Raw selector noise per pixel */
  noiseValues: Float32Array;
  /** Unique biome names in index order */
  biomeNames: string[];
}

export interface BuildBiomeSelectorMapOptions {
  resolution?: number;
  rangeMin?: number;
  rangeMax?: number;
  defaultBiome?: string;
  rootNodeId?: string;
}

function hslToRgb(hsl: string): [number, number, number] {
  const match = /hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/.exec(hsl);
  if (!match) return [128, 128, 128];
  const h = Number(match[1]) / 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

export function buildBiomeSelectorMap(
  nodes: Node[],
  edges: Edge[],
  ranges: BiomeRangeEntry[],
  options?: BuildBiomeSelectorMapOptions,
): BiomeSelectorMapResult {
  const resolution = options?.resolution ?? 64;
  const rangeMin = options?.rangeMin ?? -256;
  const rangeMax = options?.rangeMax ?? 256;
  const defaultBiome = options?.defaultBiome ?? "";

  const grid = evaluateDensityGrid(
    nodes,
    edges,
    resolution,
    rangeMin,
    rangeMax,
    0,
    options?.rootNodeId,
  );

  const biomeNames = [...ranges.map((r) => r.Biome)];
  if (defaultBiome && !biomeNames.includes(defaultBiome)) {
    biomeNames.push(defaultBiome);
  }

  const biomeIndices = new Int16Array(resolution * resolution);
  const nameToIndex = new Map<string, number>();
  ranges.forEach((r, i) => nameToIndex.set(r.Biome, i));

  for (let i = 0; i < grid.values.length; i++) {
    const noise = grid.values[i];
    const idx = resolveBiomeIndexAt(noise, ranges);
    biomeIndices[i] = idx ?? -1;
  }

  return {
    width: resolution,
    height: resolution,
    biomeIndices,
    noiseValues: grid.values,
    biomeNames,
  };
}

export function biomeSelectorMapToImageData(
  map: BiomeSelectorMapResult,
  ranges: BiomeRangeEntry[],
  defaultBiome: string,
): ImageData {
  const { width, height, biomeIndices } = map;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < biomeIndices.length; i++) {
    const idx = biomeIndices[i];
    const biomeName =
      idx >= 0 && idx < ranges.length
        ? ranges[idx].Biome
        : defaultBiome || "default";
    const [r, g, b] = hslToRgb(biomeColor(biomeName));
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  }

  return new ImageData(data, width, height);
}

export function biomeAtMapPixel(
  map: BiomeSelectorMapResult,
  ranges: BiomeRangeEntry[],
  defaultBiome: string,
  x: number,
  y: number,
): { biome: string; noise: number; index: number | null } {
  const px = Math.max(0, Math.min(map.width - 1, x));
  const py = Math.max(0, Math.min(map.height - 1, y));
  const i = py * map.width + px;
  const noise = map.noiseValues[i] ?? 0;
  const index = resolveBiomeIndexAt(noise, ranges);
  const biome = index !== null ? ranges[index].Biome : resolveBiomeAt(noise, ranges, defaultBiome);
  return { biome, noise, index };
}
