/** Normalize Tauri dialog `open()` result to a single directory path. */
export function pathFromDialogSelection(
  selected: string | string[] | null | undefined,
): string | null {
  if (!selected) return null;
  if (typeof selected === "string") return selected;
  if (Array.isArray(selected) && selected.length > 0) return selected[0] ?? null;
  return null;
}
