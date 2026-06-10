import type { Node } from "@xyflow/react";
import { stripEditorPrefix } from "@/schema/categoryPrefixes";
import { migrateToV2Names } from "@/utils/migration";

function isNestedAssetValue(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.length > 0 && typeof value[0] === "object" && value[0] !== null && "Type" in value[0];
  }
  return "Type" in (value as Record<string, unknown>);
}

/** Migrate scalar editor fields using the same rules as disk import migration. */
function migrateEditorFields(
  bareOld: string,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const migrated = migrateToV2Names({ Type: bareOld, ...fields });
  if (!migrated) return fields;

  const result: Record<string, unknown> = { ...fields };
  for (const [key, value] of Object.entries(migrated)) {
    if (key === "Type" || isNestedAssetValue(value)) continue;
    result[key] = value;
  }
  for (const key of Object.keys(fields)) {
    if (key === "Type") continue;
    if (isNestedAssetValue(fields[key])) continue;
    if (!(key in migrated)) delete result[key];
  }
  return result;
}

/**
 * Replace a legacy graph node with its modern type, preserving edges and
 * migrating scalar fields where a direct mapping exists (Zero/One, Product, etc.).
 */
export function applyLegacyNodeReplacement(
  node: Node,
  typeKey: string,
  replacement: string,
): Node {
  const data = node.data as Record<string, unknown>;
  const existingFields = (data.fields as Record<string, unknown> | undefined) ?? {};
  const bareNew = stripEditorPrefix(replacement);

  const isPrefixedSwap =
    typeKey.includes(":") &&
    !typeKey.startsWith("Material:") &&
    replacement.includes(":");

  const fields =
    isPrefixedSwap || (typeKey.startsWith("Material:") && replacement.startsWith("Layer:"))
      ? existingFields
      : migrateEditorFields(stripEditorPrefix(typeKey), existingFields);

  return {
    ...node,
    type: replacement,
    data: {
      ...data,
      type: bareNew,
      fields,
    },
  };
}
