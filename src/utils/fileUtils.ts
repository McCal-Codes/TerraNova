/**
 * Small file utilities used across the app to recognise and filter files.
 */
export function isJsonFileName(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  // Ignore macOS sidecar files that start with ._ (e.g. ._Foo.json)
  if (n.startsWith("._")) return false;
  return n.endsWith(".json");
}

export function isJsonPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const p = path.replace(/\\/g, "/").toLowerCase();
  return p.endsWith(".json") && !p.split("/").some((seg) => seg.startsWith("._"));
}
