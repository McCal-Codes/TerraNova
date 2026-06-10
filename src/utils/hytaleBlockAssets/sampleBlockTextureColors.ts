import { convertFileSrc } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { getHytaleAssetCacheRoot, pathExists } from "@/utils/ipc";
import { getHytaleBlockAssetIndex } from "./hytaleBlockAssetService";
import { resolveBlockTexture } from "./resolveTextureName";
import type { ResolvedBlockModel } from "./types";

const colorCache = new Map<string, [number, number, number]>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load texture"));
    img.src = url;
  });
}

function averageRgbFromImage(img: HTMLImageElement): [number, number, number] {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [0.5, 0.5, 0.5];

  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]!;
    if (alpha < 16) continue;
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
    count++;
  }

  if (count === 0) return [0.5, 0.5, 0.5];
  return [r / count / 255, g / count / 255, b / count / 255];
}

async function sampleTextureAtPath(absPath: string): Promise<[number, number, number] | null> {
  const cached = colorCache.get(absPath);
  if (cached) return cached;

  try {
    if (!(await pathExists(absPath))) return null;
    const url = convertFileSrc(absPath);
    const img = await loadImage(url);
    const rgb = averageRgbFromImage(img);
    colorCache.set(absPath, rgb);
    return rgb;
  } catch {
    return null;
  }
}

function blockTextureFilename(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (ref.startsWith("bt:")) return ref.slice(3);
  if (ref.toLowerCase().endsWith(".png")) return ref.split(/[/\\]/).pop() ?? ref;
  return null;
}

async function textureCandidatesForBlock(
  blockName: string,
  model: ResolvedBlockModel | null | undefined,
  blockTexturesDir: string,
  blocksDir: string,
  textureIndex: Record<string, string> | null,
): Promise<string[]> {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = async (filename: string | null) => {
    if (!filename) return;
    const abs = filename.includes("/") || filename.includes("\\")
      ? await join(blocksDir, filename.replace(/\\/g, "/"))
      : await join(blockTexturesDir, filename);
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push(abs);
  };

  await push(blockTextureFilename(model?.blockTexture));
  if (model?.texturePath) {
    await push(model.texturePath);
  }
  if (textureIndex) {
    await push(blockTextureFilename(resolveBlockTexture(blockName, textureIndex)));
  }

  return out;
}

/** Sample average RGB from synced Hytale Common/BlockTextures (and co-located model textures). */
export async function resolvePrefabBlockColors(
  resolvedModels: Record<string, ResolvedBlockModel | null>,
  options?: { blockNames?: string[] },
): Promise<Record<string, [number, number, number]>> {
  const cacheRoot = await getHytaleAssetCacheRoot();
  const blockTexturesDir = await join(cacheRoot, "Common/BlockTextures");
  const blocksDir = await join(cacheRoot, "Common/Blocks");
  const index = await getHytaleBlockAssetIndex();
  const textureIndex = index?.textureIndex ?? null;

  const names = options?.blockNames?.length
    ? options.blockNames
    : Object.keys(resolvedModels);

  const out: Record<string, [number, number, number]> = {};

  await Promise.all(
    names.map(async (blockName) => {
      const model = resolvedModels[blockName] ?? null;
      const candidates = await textureCandidatesForBlock(
        blockName,
        model,
        blockTexturesDir,
        blocksDir,
        textureIndex,
      );

      for (const absPath of candidates) {
        const rgb = await sampleTextureAtPath(absPath);
        if (rgb) {
          out[blockName] = rgb;
          return;
        }
      }
    }),
  );

  return out;
}

export function clearBlockTextureColorCache(): void {
  colorCache.clear();
}
