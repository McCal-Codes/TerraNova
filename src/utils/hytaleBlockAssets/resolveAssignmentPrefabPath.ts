import { readAssetFile } from "@/utils/ipc";
import { extractPrefabPathFromFields } from "@/utils/hytaleBlockAssets/extractPrefabPath";
import { listHytaleAssignmentNames } from "@/utils/hytaleBlockAssets/listHytaleAssignmentNames";
import { isTauriRuntime } from "@/utils/platform";

function collectPrefabPaths(value: unknown, paths: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectPrefabPaths(item, paths);
    return;
  }
  const record = value as Record<string, unknown>;
  const path = extractPrefabPathFromFields(record);
  if (path) paths.add(path);
  for (const child of Object.values(record)) {
    collectPrefabPaths(child, paths);
  }
}

/**
 * Resolve a prefab mesh path from an imported assignment / prop definition name.
 */
export async function resolveAssignmentPrefabPath(
  assignmentName: string,
  projectRoot: string | null,
): Promise<string | null> {
  const trimmed = assignmentName.trim();
  if (!trimmed || !isTauriRuntime()) return null;

  const catalog = await listHytaleAssignmentNames(projectRoot);
  const filePath = catalog.pathsByName[trimmed];
  if (!filePath) return null;

  try {
    const raw = await readAssetFile(filePath);
    if (!raw || typeof raw !== "object") return null;
    const paths = new Set<string>();
    collectPrefabPaths(raw, paths);
    return paths.values().next().value ?? null;
  } catch {
    return null;
  }
}
