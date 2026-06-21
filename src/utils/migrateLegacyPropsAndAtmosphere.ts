/**
 * Migrates legacy prop and atmosphere provider nodes to current Hytale V2 types.
 * Applied on biome/asset import so TerraNova projects stay aligned with release assets.
 */

export interface LegacyPropsAtmosphereMigrationResult {
  result: Record<string, unknown>;
  conversions: string[];
}

const PROP_LEGACY_TYPES = new Set(["Conditional", "Surface", "Cave", "Exported"]);
const PROVIDER_EXPORTED_TYPES = new Set(["Exported"]);
const DIRECTIONALITY_LEGACY_TYPES = new Set(["Uniform", "Directional", "Normal"]);

function isAssetNode(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && "Type" in value);
}

function inferCategory(parentField: string | undefined): "prop" | "environment" | "tint" | "directionality" | null {
  if (!parentField) return null;
  if (parentField === "Prop" || parentField.startsWith("Props") || parentField.startsWith("Entries")) {
    return "prop";
  }
  if (parentField === "EnvironmentProvider" || parentField === "Environment") return "environment";
  if (parentField === "TintProvider" || parentField === "Tint") return "tint";
  if (parentField === "Directionality") return "directionality";
  return null;
}

function extractNoiseSeed(condition: unknown): string {
  if (!isAssetNode(condition)) return "A";
  const seed = condition.Seed;
  if (typeof seed === "string" && seed.length > 0) return seed;
  if (typeof seed === "number") return String(seed);
  return "A";
}

function migratePropConditional(node: Record<string, unknown>): Record<string, unknown> {
  const entries: Record<string, unknown>[] = [];
  const trueInput = node.TrueInput;
  const falseInput = node.FalseInput;
  if (isAssetNode(trueInput)) entries.push({ Weight: 1, Prop: trueInput });
  if (isAssetNode(falseInput)) entries.push({ Weight: 1, Prop: falseInput });

  const migrated: Record<string, unknown> = {
    Type: "Weighted",
    Seed: extractNoiseSeed(node.Condition),
    Entries: entries,
  };
  if (node.Skip !== undefined) migrated.Skip = node.Skip;
  if (node.$NodeId !== undefined) migrated.$NodeId = node.$NodeId;
  return migrated;
}

function migratePropSurfaceOrCave(node: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = {
    Type: "Locator",
    PlacementCap: 1,
  };
  if (node.Pattern !== undefined) migrated.Pattern = node.Pattern;
  if (node.Scanner !== undefined) migrated.Scanner = node.Scanner;
  migrated.Prop = isAssetNode(node.Prop)
    ? node.Prop
    : { Type: "Manual", Blocks: [] };
  if (node.Skip !== undefined) migrated.Skip = node.Skip;
  if (node.$NodeId !== undefined) migrated.$NodeId = node.$NodeId;
  return migrated;
}

function unwrapExportedProvider(node: Record<string, unknown>): Record<string, unknown> | null {
  const input = node.Input;
  if (isAssetNode(input)) return input;
  return null;
}

function migrateDirectionality(node: Record<string, unknown>): Record<string, unknown> {
  const type = node.Type as string;
  if (type === "Uniform") {
    return {
      ...node,
      Type: "Random",
      Seed: typeof node.Seed === "string" ? node.Seed : "A",
      Pattern: isAssetNode(node.Pattern) ? node.Pattern : { Type: "Floor" },
    };
  }
  if (type === "Directional") {
    return { ...node, Type: "Static" };
  }
  if (type === "Normal") {
    return { ...node, Type: "Pattern" };
  }
  return node;
}

/**
 * Recursively upgrade legacy prop/atmosphere nodes in a biome wrapper or asset tree.
 */
export function migrateLegacyPropsAndAtmosphere(
  root: Record<string, unknown>,
): LegacyPropsAtmosphereMigrationResult {
  const conversions: string[] = [];

  function walk(node: Record<string, unknown>, parentField?: string): Record<string, unknown> {
    let current = { ...node };
    const category = inferCategory(parentField);
    const type = current.Type as string | undefined;

    if (type && category === "prop" && PROP_LEGACY_TYPES.has(type)) {
      if (type === "Conditional") {
        conversions.push("Prop:Conditional → Prop:Weighted");
        current = migratePropConditional(current);
      } else if (type === "Surface" || type === "Cave") {
        conversions.push(`Prop:${type} → Prop:Locator`);
        current = migratePropSurfaceOrCave(current);
      } else if (type === "Exported") {
        const unwrapped = unwrapExportedProvider(current);
        if (unwrapped) {
          conversions.push("Prop:Exported → (unwrapped Input)");
          return walk(unwrapped, parentField);
        }
      }
    }

    if (
      type
      && PROVIDER_EXPORTED_TYPES.has(type)
      && (category === "environment" || category === "tint")
    ) {
      const unwrapped = unwrapExportedProvider(current);
      if (unwrapped) {
        conversions.push(`${category === "environment" ? "Environment" : "Tint"}:Exported → (unwrapped Input)`);
        return walk(unwrapped, parentField);
      }
    }

    if (type && category === "directionality" && DIRECTIONALITY_LEGACY_TYPES.has(type)) {
      const nextType =
        type === "Uniform" ? "Random" : type === "Directional" ? "Static" : "Pattern";
      conversions.push(`Directionality:${type} → Directionality:${nextType}`);
      current = migrateDirectionality(current);
    }

    for (const [key, value] of Object.entries(current)) {
      if (key === "Type") continue;
      if (isAssetNode(value)) {
        current[key] = walk(value, key);
      } else if (Array.isArray(value)) {
        current[key] = value.map((item) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? walk(item as Record<string, unknown>, key)
            : item,
        );
      } else if (value && typeof value === "object") {
        current[key] = walk(value as Record<string, unknown>, key);
      }
    }

    return current;
  }

  const result = walk(root);
  return { result, conversions };
}
