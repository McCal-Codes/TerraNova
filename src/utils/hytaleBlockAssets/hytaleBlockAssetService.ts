import { join } from "@tauri-apps/api/path";
import { isTauriRuntime } from "@/utils/platform";
import { getHytaleAssetCacheRoot, readAssetFile, resolveBundledHytaleAssetPath, scanHytaleBlockAssetIndex } from "@/utils/ipc";
import { parseBlockyModel, type BlockyModelJson } from "./parseBlockyModel";
import type { BlockAssetIndex, BlockModelBox, PrefabJson, ResolvedBlockModel } from "./types";
import { resolveBlockModel, resolveBlockModels } from "./resolveBlockModel";

let cachedIndex: BlockAssetIndex | null = null;
const parsedModelCache = new Map<string, BlockModelBox[] | null>();
const resolveCache = new Map<string, ResolvedBlockModel | null>();

/** Load and cache `.blockymodel` JSON from an absolute path (call after index scan). */
export async function loadBlockyModelBoxes(absPath: string): Promise<BlockModelBox[] | null> {
  if (parsedModelCache.has(absPath)) {
    return parsedModelCache.get(absPath) ?? null;
  }
  if (!isTauriRuntime()) return null;
  try {
    const raw = await readAssetFile(absPath);
    const boxes = parseBlockyModel(raw as BlockyModelJson);
    parsedModelCache.set(absPath, boxes);
    return boxes;
  } catch {
    parsedModelCache.set(absPath, null);
    return null;
  }
}

function getBoxesSync(relPath: string, absPath: string): BlockModelBox[] | null {
  void relPath;
  return parsedModelCache.get(absPath) ?? null;
}

export async function getHytaleBlockAssetIndex(): Promise<BlockAssetIndex | null> {
  if (cachedIndex) return cachedIndex;
  if (!isTauriRuntime()) return null;

  try {
    cachedIndex = await scanHytaleBlockAssetIndex();
    return cachedIndex;
  } catch {
    return null;
  }
}

export async function resolveHytaleBlockModels(
  blockNames: string[],
): Promise<Record<string, ResolvedBlockModel | null>> {
  const index = await getHytaleBlockAssetIndex();
  if (!index) return Object.fromEntries(blockNames.map((n) => [n, null]));

  const uniquePaths = new Set<string>();
  resolveBlockModels(blockNames, index, (rel, abs) => {
    uniquePaths.add(abs);
    return getBoxesSync(rel, abs);
  });

  await Promise.all([...uniquePaths].map((abs) => loadBlockyModelBoxes(abs)));

  const resolved: Record<string, ResolvedBlockModel | null> = {};
  for (const name of blockNames) {
    const cacheKey = name;
    if (resolveCache.has(cacheKey)) {
      resolved[name] = resolveCache.get(cacheKey) ?? null;
      continue;
    }
    const model = resolveBlockModel(name, index, getBoxesSync);
    resolveCache.set(cacheKey, model);
    resolved[name] = model;
  }
  return resolved;
}

export async function readHytalePrefab(relativePath: string): Promise<PrefabJson | null> {
  if (!isTauriRuntime()) return null;
  try {
    const abs = await resolveBundledHytaleAssetPath(`Server/Prefabs/${relativePath}`);
    const raw = await readAssetFile(abs);
    if (raw && typeof raw === "object" && Array.isArray((raw as PrefabJson).blocks)) {
      return raw as PrefabJson;
    }
    return null;
  } catch {
    return null;
  }
}

/** Try project pack prefab paths first, then hytale-assets. */
export async function readPrefabFromPaths(
  relativePath: string,
  projectRoot?: string | null,
): Promise<{ prefab: PrefabJson; resolvedPath: string } | null> {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\//, "").replace(/\.prefab\.json$/i, "");

  if (isTauriRuntime()) {
    try {
      const { resolveHytalePrefabPath } = await import("@/utils/ipc");
      const resolvedPath = await resolveHytalePrefabPath(normalized, projectRoot ?? null);
      const raw = await readAssetFile(resolvedPath);
      if (raw && typeof raw === "object" && Array.isArray((raw as PrefabJson).blocks)) {
        return { prefab: raw as PrefabJson, resolvedPath };
      }
    } catch {
      // fall through to legacy candidate loop
    }
  }

  const candidates: string[] = [];

  if (projectRoot) {
    candidates.push(
      await join(projectRoot, "Server", "Prefabs", `${normalized}.prefab.json`),
      await join(projectRoot, "Server", "Prefabs", `${normalized}.json`),
    );
  }

  if (isTauriRuntime()) {
    try {
      const cacheRoot = await getHytaleAssetCacheRoot();
      candidates.push(
        await join(cacheRoot, "Server", "Prefabs", `${normalized}.prefab.json`),
      );
    } catch {
      // cache unavailable
    }
  }

  for (const path of candidates) {
    try {
      const raw = await readAssetFile(path);
      if (raw && typeof raw === "object" && Array.isArray((raw as PrefabJson).blocks)) {
        return { prefab: raw as PrefabJson, resolvedPath: path };
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

export function clearHytaleBlockAssetCache(): void {
  cachedIndex = null;
  parsedModelCache.clear();
  resolveCache.clear();
}
