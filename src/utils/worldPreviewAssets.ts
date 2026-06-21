import type { ChunkDataResponse } from "./ipc";
import { resolveHytaleBlockModels } from "./hytaleBlockAssets";
import { resolvePrefabBlockColors } from "./hytaleBlockAssets/sampleBlockTextureColors";
import type { ResolvedBlockModel } from "./hytaleBlockAssets/types";

export function isWaterBlockName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("lava")) return false;
  return (
    n.includes("fluid_water") ||
    n === "water" ||
    n.endsWith("_water") ||
    n.includes("water_fluid")
  );
}

export function rgbToHex(rgb: [number, number, number]): string {
  const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  const r = clamp(rgb[0]).toString(16).padStart(2, "0");
  const g = clamp(rgb[1]).toString(16).padStart(2, "0");
  const b = clamp(rgb[2]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

export async function resolveWorldPaletteAssets(palette: Record<string, string>): Promise<{
  blockColors: Record<string, [number, number, number]>;
  resolvedModels: Record<string, ResolvedBlockModel | null>;
  texturedCount: number;
  totalBlockTypes: number;
}> {
  const blockNames = [...new Set(Object.values(palette).filter(Boolean))];
  const resolvedModels = await resolveHytaleBlockModels(blockNames);
  const blockColors = await resolvePrefabBlockColors(resolvedModels, { blockNames });
  return {
    blockColors,
    resolvedModels,
    texturedCount: Object.keys(blockColors).length,
    totalBlockTypes: blockNames.length,
  };
}

const CHUNK_SIZE = 32;

/**
 * Approximate surface water level from loaded chunks (highest water block near each column surface).
 */
export function detectWaterLevel(
  chunks: ChunkDataResponse[],
  palette: Record<string, string>,
): number | null {
  const waterIds = new Set<number>();
  for (const [idStr, name] of Object.entries(palette)) {
    if (!isWaterBlockName(name)) continue;
    const id = parseInt(idStr, 10);
    if (!isNaN(id) && id > 0) waterIds.add(id);
  }
  if (waterIds.size === 0) return null;

  let bestY = -Infinity;

  for (const chunk of chunks) {
    const yr = chunk.yMax - chunk.yMin;

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const surfaceY = chunk.heightmap[lz * CHUNK_SIZE + lx] ?? chunk.yMax;
        const scanTop = Math.min(chunk.yMax, surfaceY + 6);
        const scanBottom = Math.max(chunk.yMin, surfaceY - 8);

        for (let y = scanTop; y >= scanBottom; y--) {
          const idx = (lz * CHUNK_SIZE + lx) * yr + (y - chunk.yMin);
          const blockId = chunk.blocks[idx] ?? 0;
          if (waterIds.has(blockId)) {
            bestY = Math.max(bestY, y);
            break;
          }
        }
      }
    }

    if (bestY === -Infinity) {
      const yr = chunk.yMax - chunk.yMin;
      for (let i = 0; i < chunk.blocks.length; i++) {
        const blockId = chunk.blocks[i] ?? 0;
        if (!waterIds.has(blockId)) continue;
        const y = chunk.yMin + (i % yr);
        bestY = Math.max(bestY, y);
      }
    }
  }

  return bestY > -Infinity ? bestY : null;
}
