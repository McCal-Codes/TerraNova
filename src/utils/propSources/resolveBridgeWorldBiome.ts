import { listDirectory, pathExists, readAssetFile, type BridgeDiscovery, type DirectoryEntryData } from "@/utils/ipc";

export interface BridgeWorldBiomeRef {
  biomePath: string;
  biomeName: string;
  worldStructure: string;
  source: "bridge-mod" | "editor-instance";
}

async function findBiomeFileByName(
  biomesRoot: string,
  biomeName: string,
): Promise<string | null> {
  const queue: string[] = [biomesRoot];
  const target = biomeName.trim().toLowerCase();
  if (!target) return null;

  while (queue.length > 0) {
    const dir = queue.shift()!;
    let entries: DirectoryEntryData[];
    try {
      entries = await listDirectory(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = `${dir.replace(/\\/g, "/")}/${entry.name}`;
      if (entry.is_dir) {
        queue.push(fullPath);
        continue;
      }
      if (!entry.name.toLowerCase().endsWith(".json")) continue;
      const stem = entry.name.replace(/\.json$/i, "");
      if (stem.toLowerCase() === target) return fullPath;
      try {
        const raw = (await readAssetFile(fullPath)) as Record<string, unknown>;
        const name = typeof raw.Name === "string" ? raw.Name.trim().toLowerCase() : "";
        if (name === target) return fullPath;
      } catch {
        // skip unreadable biome
      }
    }
  }
  return null;
}

/**
 * Resolve the biome JSON file used by a Bridge-connected mod pack's world structure.
 * Uses WorldStructure → DefaultBiome (not chunk voxel extraction).
 */
export async function resolveBridgeWorldBiomeForProps(input: {
  modPackPath: string;
  worldStructureName?: string | null;
}): Promise<BridgeWorldBiomeRef | null> {
  const modPack = input.modPackPath?.trim();
  if (!modPack) return null;

  const norm = modPack.replace(/\\/g, "/").replace(/\/+$/, "");
  const serverRoot = `${norm}/Server`;
  const wsName = input.worldStructureName?.trim();
  if (!wsName) return null;

  const wsPath = `${serverRoot}/HytaleGenerator/WorldStructures/${wsName}.json`;
  if (!(await pathExists(wsPath))) return null;

  let worldStructure: Record<string, unknown>;
  try {
    worldStructure = (await readAssetFile(wsPath)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const biomeName =
    typeof worldStructure.DefaultBiome === "string" ? worldStructure.DefaultBiome.trim() : "";
  if (!biomeName) return null;

  const biomesRoot = `${serverRoot}/HytaleGenerator/Biomes`;
  if (!(await pathExists(biomesRoot))) return null;

  const biomePath = await findBiomeFileByName(biomesRoot, biomeName);
  if (!biomePath) return null;

  return {
    biomePath,
    biomeName,
    worldStructure: wsName,
    source: "bridge-mod",
  };
}

/**
 * Resolve the world-structure JSON stem for Bridge prop import.
 * Prefers the open instance config, then live instance metadata — never display labels.
 */
export function resolveBridgeWorldStructureName(input: {
  instanceWorldStructure?: string | null;
  discovery?: BridgeDiscovery | null;
}): string | null {
  const fromInstance = input.instanceWorldStructure?.trim();
  if (fromInstance) return fromInstance;

  const discovery = input.discovery;
  if (!discovery) return null;

  const live = discovery.instanceWorlds?.find((w) => w.isLive);
  if (live?.worldStructure?.trim()) return live.worldStructure.trim();

  if (discovery.playerWorld) {
    const match = discovery.instanceWorlds?.find((w) => w.worldId === discovery.playerWorld);
    if (match?.worldStructure?.trim()) return match.worldStructure.trim();
  }

  return null;
}
