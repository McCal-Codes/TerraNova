import type { DirectoryEntryData } from "@/utils/ipc";
import { listDirectory, readAssetFile } from "@/utils/ipc";
import {
  asRecord,
  deepMergeRecords,
  normalizeAssetName,
  type JsonRecord,
} from "./jsonUtils";

function trimTrailingSeparators(path: string): string {
  return path.replace(/[\\/]+$/, "");
}

function joinServerPath(base: string, child: string): string {
  const separator = base.includes("\\") ? "\\" : "/";
  const cleanedBase = trimTrailingSeparators(base);
  return `${cleanedBase}${separator}${child}`;
}

export interface AssetIndex {
  environmentPaths: Map<string, string>;
  weatherPaths: Map<string, string>;
}

export interface AtmosphereAssetDeps {
  listDirectoryFn: typeof listDirectory;
  readAssetFileFn: typeof readAssetFile;
}

export interface LoadedEnvironment {
  mergedEnvironment: JsonRecord | null;
  requestedPath: string | null;
  parentChain: string[];
  warnings: string[];
}

const assetIndexCache = new Map<string, Promise<AssetIndex>>();

function collectJsonFilePaths(entries: DirectoryEntryData[]): string[] {
  const result: string[] = [];
  const stack = [...entries];
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) continue;
    if (entry.is_dir) {
      if (Array.isArray(entry.children)) {
        for (const child of entry.children) {
          stack.push(child);
        }
      }
      continue;
    }
    if (entry.path.toLowerCase().endsWith(".json")) {
      result.push(entry.path);
    }
  }
  return result;
}

function fileStem(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const fileName = normalized.slice(normalized.lastIndexOf("/") + 1);
  return fileName.replace(/\.json$/i, "");
}

export function createAssetNameIndex(paths: string[]): Map<string, string> {
  const sortedPaths = [...paths].sort((left, right) => left.localeCompare(right));
  const index = new Map<string, string>();
  for (const path of sortedPaths) {
    const key = fileStem(path).toLowerCase();
    if (!index.has(key)) {
      index.set(key, path);
    }
  }
  return index;
}

export async function buildAssetIndex(
  serverRoot: string,
  deps: AtmosphereAssetDeps,
): Promise<AssetIndex> {
  const environmentsDir = joinServerPath(serverRoot, "Environments");
  const weathersDir = joinServerPath(serverRoot, "Weathers");
  const [environmentEntries, weatherEntries] = await Promise.all([
    deps.listDirectoryFn(environmentsDir),
    deps.listDirectoryFn(weathersDir),
  ]);
  return {
    environmentPaths: createAssetNameIndex(collectJsonFilePaths(environmentEntries)),
    weatherPaths: createAssetNameIndex(collectJsonFilePaths(weatherEntries)),
  };
}

export async function getAssetIndex(
  serverRoot: string,
  deps: AtmosphereAssetDeps,
): Promise<AssetIndex> {
  const key = serverRoot.toLowerCase();
  if (!assetIndexCache.has(key)) {
    const pending = buildAssetIndex(serverRoot, deps).catch((error) => {
      assetIndexCache.delete(key);
      throw error;
    });
    assetIndexCache.set(key, pending);
  }
  return assetIndexCache.get(key)!;
}

export function clearAtmosphereAssetIndexCache(): void {
  assetIndexCache.clear();
}

export function inferSuggestedParentEnvironment(
  currentFile: string | null,
  knownEnvironmentNames: string[],
): string {
  const envNames = knownEnvironmentNames.filter((name) => /^Env_/i.test(name));
  const normalizedPath = (currentFile ?? "").replace(/\\/g, "/").toLowerCase();
  const findExact = (candidate: string) => envNames.find((name) => name.toLowerCase() === candidate.toLowerCase()) ?? null;
  const findPrefix = (candidatePrefix: string) => envNames.find((name) => name.toLowerCase().startsWith(candidatePrefix.toLowerCase())) ?? null;
  const findContains = (fragment: string) => envNames.find((name) => name.toLowerCase().includes(fragment.toLowerCase())) ?? null;

  if (normalizedPath.includes("void")) {
    return findExact("Env_Default_Void")
      ?? findContains("void")
      ?? "Env_Default_Void";
  }

  const zoneMatch = /zone[_ -]?(\d+)/i.exec(normalizedPath);
  if (zoneMatch) {
    const zonePrefix = `Env_Zone${zoneMatch[1]}`;
    return findExact(zonePrefix)
      ?? findPrefix(zonePrefix)
      ?? findContains(`zone${zoneMatch[1]}`)
      ?? findExact("Env_Zone1")
      ?? findPrefix("Env_Zone1")
      ?? findExact("Env_Default_Flat")
      ?? "Env_Zone1";
  }

  return findExact("Env_Zone1")
    ?? findPrefix("Env_Zone1")
    ?? findExact("Env_Default_Flat")
    ?? findPrefix("Env_Default")
    ?? envNames[0]
    ?? "Env_Zone1";
}

export async function loadEnvironmentWithParents(
  environmentName: string,
  assetIndex: AssetIndex,
  deps: AtmosphereAssetDeps,
): Promise<LoadedEnvironment> {
  const warnings: string[] = [];
  const requestedPath = assetIndex.environmentPaths.get(environmentName.toLowerCase()) ?? null;
  if (!requestedPath) {
    warnings.push(`Environment "${environmentName}" was not found in Server/Environments.`);
    return { mergedEnvironment: null, requestedPath: null, parentChain: [], warnings };
  }

  const chain: JsonRecord[] = [];
  const parentChain: string[] = [];
  const visited = new Set<string>();
  let currentEnvironment: string | null = environmentName;

  while (currentEnvironment) {
    const key = currentEnvironment.toLowerCase();
    if (visited.has(key)) {
      warnings.push(`Environment parent cycle detected at "${currentEnvironment}".`);
      break;
    }
    visited.add(key);
    parentChain.unshift(currentEnvironment);

    const envPath = assetIndex.environmentPaths.get(key);
    if (!envPath) {
      warnings.push(`Environment "${currentEnvironment}" was not found in Server/Environments.`);
      break;
    }

    const rawEnv = await deps.readAssetFileFn(envPath);
    const env = asRecord(rawEnv);
    if (!env) {
      warnings.push(`Environment file "${envPath}" is not a JSON object.`);
      break;
    }

    chain.unshift(env);
    currentEnvironment = normalizeAssetName(env.Parent);
  }

  if (chain.length === 0) {
    return { mergedEnvironment: null, requestedPath, parentChain, warnings };
  }

  const mergedEnvironment = chain.reduce<JsonRecord>((acc, env) => deepMergeRecords(acc, env), {});
  return { mergedEnvironment, requestedPath, parentChain, warnings };
}

export async function loadEnvironmentDocWithParentsFromFile(
  environmentDoc: JsonRecord,
  environmentName: string,
  assetIndex: AssetIndex,
  deps: AtmosphereAssetDeps,
): Promise<LoadedEnvironment> {
  const loaded = await loadEnvironmentWithParents(environmentName, assetIndex, deps);
  if (!loaded.mergedEnvironment) {
    return {
      ...loaded,
      mergedEnvironment: environmentDoc,
      parentChain: [environmentName],
    };
  }
  return {
    ...loaded,
    mergedEnvironment: deepMergeRecords(loaded.mergedEnvironment, environmentDoc),
  };
}
