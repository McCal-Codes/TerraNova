export const PREFAB_CATEGORY_ALL = "All";

export interface PrefabFilterOptions {
  query?: string;
  category?: string;
}

/** Derive a folder chip label from a prefab relative path. */
export function getPrefabCategory(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return "root";
  if (parts[0] === "props" && parts.length >= 2) return parts[1]!;
  return parts[0]!;
}

/** Unique sorted categories for chip row (excludes "All"). */
export function listPrefabCategories(paths: string[]): string[] {
  const seen = new Set<string>();
  for (const path of paths) {
    seen.add(getPrefabCategory(path));
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function filterPrefabPaths(paths: string[], options: PrefabFilterOptions): string[] {
  const q = options.query?.trim().toLowerCase() ?? "";
  const category = options.category?.trim();
  const useCategory = category && category !== PREFAB_CATEGORY_ALL;

  return paths.filter((path) => {
    if (useCategory && getPrefabCategory(path) !== category) return false;
    if (q && !path.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function shortPrefabLeaf(path: string): string {
  if (!path) return "(none)";
  const leaf = path.split("/").pop() ?? path;
  return leaf.replace(/_/g, " ");
}
