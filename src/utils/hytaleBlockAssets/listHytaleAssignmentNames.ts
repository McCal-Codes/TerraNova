import { join } from "@tauri-apps/api/path";
import { getHytaleAssetCacheRoot, listDirectory, pathExists, readAssetFile } from "@/utils/ipc";
import { isTauriRuntime } from "@/utils/platform";

export const ASSIGNMENT_NAME_LIST_CAP = 4000;

function assignmentStemFromRelativePath(rel: string): string {
  const parts = rel.replace(/\.json$/i, "").split("/");
  return parts[parts.length - 1] ?? rel;
}

async function collectAssignmentEntriesFromDirectory(
  assignmentsRootAbs: string,
  dirPrefix: string,
  out: Array<{ name: string; filePath: string }>,
  cap = ASSIGNMENT_NAME_LIST_CAP,
): Promise<void> {
  if (out.length >= cap) return;
  if (!(await pathExists(assignmentsRootAbs))) return;

  const entries = await listDirectory(assignmentsRootAbs);
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (out.length >= cap) return;
    if (entry.is_dir) {
      const nextPrefix = dirPrefix ? `${dirPrefix}/${entry.name}` : entry.name;
      await collectAssignmentEntriesFromDirectory(entry.path, nextPrefix, out, cap);
      continue;
    }
    if (!entry.name.endsWith(".json")) continue;
    const rel = dirPrefix ? `${dirPrefix}/${entry.name}` : entry.name;
    out.push({
      name: assignmentStemFromRelativePath(rel),
      filePath: entry.path,
    });
  }
}

async function resolveExportAsName(filePath: string, fallback: string): Promise<string> {
  try {
    const raw = await readAssetFile(filePath);
    if (typeof raw !== "object" || raw == null) return fallback;
    const exportAs = (raw as Record<string, unknown>).ExportAs;
    return typeof exportAs === "string" && exportAs.trim() ? exportAs.trim() : fallback;
  } catch {
    return fallback;
  }
}

export interface HytaleAssignmentNameCatalog {
  names: string[];
  pathsByName: Record<string, string>;
  truncated: boolean;
  error: string | null;
}

/** List assignment ExportAs names from project pack and synced asset cache. */
export async function listHytaleAssignmentNames(
  projectRoot: string | null,
): Promise<HytaleAssignmentNameCatalog> {
  if (!isTauriRuntime()) {
    return {
      names: [],
      pathsByName: {},
      truncated: false,
      error: "Assignment catalog requires the TerraNova desktop app.",
    };
  }

  const entries: Array<{ name: string; filePath: string }> = [];
  const pathsByName: Record<string, string> = {};
  let truncated = false;

  try {
    if (projectRoot) {
      const projectAssignments = await join(projectRoot, "Server", "HytaleGenerator", "Assignments");
      await collectAssignmentEntriesFromDirectory(projectAssignments, "", entries);
    }

    if (entries.length < ASSIGNMENT_NAME_LIST_CAP) {
      const cacheRoot = await getHytaleAssetCacheRoot();
      const cacheAssignments = await join(cacheRoot, "Server", "HytaleGenerator", "Assignments");
      await collectAssignmentEntriesFromDirectory(
        cacheAssignments,
        "",
        entries,
        ASSIGNMENT_NAME_LIST_CAP,
      );
    } else {
      truncated = true;
    }

    const seen = new Set<string>();
    const names: string[] = [];

    const registerName = (alias: string, filePath: string) => {
      const trimmed = alias.trim();
      if (!trimmed) return;
      if (!pathsByName[trimmed]) {
        pathsByName[trimmed] = filePath;
      }
      if (seen.has(trimmed)) return;
      seen.add(trimmed);
      names.push(trimmed);
    };

    for (const entry of entries.slice(0, ASSIGNMENT_NAME_LIST_CAP)) {
      const resolvedName = await resolveExportAsName(entry.filePath, entry.name);
      registerName(resolvedName, entry.filePath);
      if (entry.name !== resolvedName) {
        registerName(entry.name, entry.filePath);
      }
    }

    names.sort((a, b) => a.localeCompare(b));
    if (entries.length >= ASSIGNMENT_NAME_LIST_CAP) truncated = true;

    return { names, pathsByName, truncated, error: null };
  } catch (err) {
    return {
      names: [],
      pathsByName: {},
      truncated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
