import type { CategoryDefaultsEntry } from "@/schema/defaults";
import { CATEGORY_TO_EDITOR_PREFIX } from "@/schema/categoryPrefixes";

export function resolveNodeTypeKey(entry: CategoryDefaultsEntry): string {
  if (entry.type.includes(":")) return entry.type;
  const prefix = CATEGORY_TO_EDITOR_PREFIX[entry.category];
  return prefix ? `${prefix}:${entry.type}` : entry.type;
}
