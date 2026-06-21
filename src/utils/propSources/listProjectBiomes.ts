import { listDirectory, type DirectoryEntryData } from "@/utils/ipc";
import { inferServerRoot } from "@/utils/pathUtils";

export interface ProjectBiomeEntry {
  name: string;
  path: string;
}

function collectBiomeJsonFiles(entries: DirectoryEntryData[], acc: ProjectBiomeEntry[]): void {
  for (const entry of entries) {
    if (entry.is_dir && entry.children) {
      collectBiomeJsonFiles(entry.children, acc);
      continue;
    }
    if (!entry.is_dir && entry.name.toLowerCase().endsWith(".json")) {
      acc.push({
        name: entry.name.replace(/\.json$/i, ""),
        path: entry.path,
      });
    }
  }
}

export function resolveProjectServerRoot(
  projectPath: string | null,
  currentFile: string | null,
): string | null {
  return inferServerRoot(currentFile, projectPath);
}

/** List biome JSON files under the open project's Server/HytaleGenerator/Biomes tree. */
export async function listProjectBiomes(
  projectPath: string | null,
  currentFile: string | null,
): Promise<ProjectBiomeEntry[]> {
  const serverRoot = resolveProjectServerRoot(projectPath, currentFile);
  if (!serverRoot) return [];

  const biomesRoot = `${serverRoot.replace(/\\/g, "/").replace(/\/+$/, "")}/HytaleGenerator/Biomes`;
  const entries = await listDirectory(biomesRoot);
  const files: ProjectBiomeEntry[] = [];
  collectBiomeJsonFiles(entries, files);
  files.sort((a, b) => a.name.localeCompare(b.name));
  return files;
}
