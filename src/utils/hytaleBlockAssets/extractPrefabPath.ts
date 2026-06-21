/** Read a prefab relative path from Prop:Prefab node fields. */
export function extractPrefabPathFromFields(fields: Record<string, unknown>): string | null {
  const direct = fields.Path;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const weighted = fields.WeightedPrefabPaths;
  if (Array.isArray(weighted)) {
    for (const entry of weighted) {
      if (!entry || typeof entry !== "object") continue;
      const path = (entry as { Path?: unknown }).Path;
      if (typeof path === "string" && path.trim()) {
        return path.trim();
      }
    }
  }

  const prop = fields.Prop;
  if (prop && typeof prop === "object" && !Array.isArray(prop)) {
    const nested = extractPrefabPathFromFields(prop as Record<string, unknown>);
    if (nested) return nested;
  }

  return null;
}

/** Strip leading slashes and optional `.prefab.json` suffix for candidate resolution. */
export function normalizePrefabRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\//, "").replace(/\.prefab\.json$/i, "");
}
