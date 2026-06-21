import { describeEnvironmentProvider } from "@/utils/atmosphere";

export interface BiomeBrowserMeta {
  environmentLabel: string;
  tintColors: string[];
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function collectTintColors(value: unknown, out: string[], limit: number): void {
  if (out.length >= limit || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) collectTintColors(item, out, limit);
    return;
  }
  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (record.Type === "Constant" && typeof record.Color === "string" && HEX_COLOR.test(record.Color)) {
    if (!out.includes(record.Color)) out.push(record.Color);
    return;
  }
  for (const child of Object.values(record)) collectTintColors(child, out, limit);
}

/** Lightweight biome JSON summary for browser rows (tint swatch + resolved environment). */
export function extractBiomeBrowserMeta(biomeJson: unknown): BiomeBrowserMeta {
  const root =
    biomeJson && typeof biomeJson === "object" && !Array.isArray(biomeJson)
      ? (biomeJson as Record<string, unknown>)
      : {};

  const tintColors: string[] = [];
  collectTintColors(root.TintProvider, tintColors, 6);

  return {
    environmentLabel: describeEnvironmentProvider(root.EnvironmentProvider),
    tintColors,
  };
}
