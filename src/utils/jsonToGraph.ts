import type { Node, Edge } from "@xyflow/react";
import bundleJson from "@/data/terranova-bundle.json";
import { HYTALE_ARRAY_TO_NAMED } from "./translationMaps";
import { getSchemaCategory } from "@/schema/schemaLoader";
import {
  BUNDLE_CATEGORY_TO_ASSET,
  CATEGORY_TO_EDITOR_PREFIX,
  FIELD_CATEGORY_PREFIX,
} from "@/schema/categoryPrefixes";
import { AssetCategory } from "@/schema/types";

const bundleNodes = (bundleJson as { nodes: Record<string, { category: string }> }).nodes;

/** Nesting fields that imply a Curve child even when the Type string is density-category (Mix). */
const CURVE_NESTING_FIELDS = new Set([
  "Curve",
  "Curves",
  "ReturnCurve",
  "AngleCurve",
  "DistanceCurve",
  "PinchCurve",
  "TwistCurve",
  "RadialCurve",
  "AxialCurve",
]);

/** Editor prefix for a bare Hytale Type string (Manual → Curve, Mix → none). */
function editorPrefixFromBareBundleType(assetType: string): string | null {
  const bundleNode = bundleNodes[assetType];
  if (!bundleNode) return null;
  const assetCategory = BUNDLE_CATEGORY_TO_ASSET[bundleNode.category];
  if (!assetCategory || assetCategory === AssetCategory.Density) return null;
  return CATEGORY_TO_EDITOR_PREFIX[assetCategory] ?? null;
}

interface V2Asset {
  Type?: string;
  [key: string]: unknown;
}

interface GraphResult {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Migration map for renamed handles (compound inputs refactor).
 * Maps nodeType → { oldHandleId → newHandleId }.
 */
const HANDLE_MIGRATION: Record<string, Record<string, string>> = {
  Sum:                          { InputA: "Inputs[0]", InputB: "Inputs[1]" },
  "Curve:Blend":                { InputA: "Inputs[0]", InputB: "Inputs[1]" },
  "Material:NoiseSelectorMaterial": { InputA: "Inputs[0]", InputB: "Inputs[1]" },
  "Material:NoiseSelector":     { InputA: "Inputs[0]", InputB: "Inputs[1]" },
  // V2 uses singular "Material" field; registry expects "Materials[0]"
  "Material:SimpleHorizontal":  { Material: "Materials[0]" },
  "Material:Striped":           { Material: "Materials[0]" },
};

function migrateHandle(nodeType: string, rawType: string, handle: string): string {
  return HANDLE_MIGRATION[nodeType]?.[handle]
    ?? HANDLE_MIGRATION[rawType]?.[handle]
    ?? handle;
}

/** Fields that are known to contain nested V2 assets (density functions, etc.) */
// const NESTED_ASSET_FIELDS = [
//   // Density inputs
//   "Input",
//   "InputA",
//   "InputB",
//   "Source",
//   "Condition",
//   "TrueInput",
//   "FalseInput",
//   "Factor",
//   // Cross-category references
//   "Density",
//   "DensityFunction",
//   "FieldFunction",
//   "Curve",
//   "Pattern",
//   "SubPattern",
//   "PositionProvider",
//   "VectorProvider",
//   "MaterialProvider",
//   "Scanner",
//   "ChildScanner",
//   "Prop",
//   // Material-specific
//   "Solid",
//   "Empty",
//   "Low",
//   "High",
//   // Layer / SpaceAndDepth V2
//   "Layers",
//   "Material",
//   "ThicknessFunctionXZ",
//   // Pattern surface fields
//   "Floor",
//   "Ceiling",
//   "Origin",
//   "Surface",
//   // Assignment
//   "Top",
//   "Bottom",
//   // Coordinates
//   "X",
//   "Y",
//   "Z",
//   "Min",
//   "Max",
// ];

/**
 * Map from parent field name → category prefix for the nested asset.
 * When a nested asset is extracted from one of these fields, its node type
 * gets prefixed with the category so the correct custom node component is used.
 */
const SCHEMA_CATEGORY_PREFIX = CATEGORY_TO_EDITOR_PREFIX;

const NON_DENSITY_BARE_SCHEMA_TYPES = new Set([
  "AlwaysTrueCondition",
  "AndCondition",
  "EqualsCondition",
  "GreaterThanCondition",
  "NotCondition",
  "OrCondition",
  "SmallerThanCondition",
  "ConstantThickness",
  "NoiseThickness",
  "RangeThickness",
  "WeightedThickness",
  "BiomeAsset",
  "DAOTerrain",
  "HytaleGenerator",
  "NoiseRange",
  "WorldStructureAsset",
  "WorldStructureNoiseRange",
]);

/**
 * Resolve the display type name for a node.
 * Density types use bare names; other categories get "Category:Type" prefixes.
 */
function isConditionSchemaType(assetType: string): boolean {
  // Bare condition types resolve as Density in the bundle; prefixed lookup is authoritative.
  if (getSchemaCategory(`Condition:${assetType}`) === AssetCategory.Condition) {
    return true;
  }
  return getSchemaCategory(assetType) === AssetCategory.Condition;
}

export type ImportGraphCategory = "material" | "density" | "position" | "assignment";

const ROOT_FIELD_IMPORT_CATEGORY: Record<string, ImportGraphCategory> = {
  MaterialProvider: "material",
  Positions: "position",
  Assignments: "assignment",
  Terrain: "density",
};

const MATERIAL_NESTED_FIELDS = new Set([
  "TrueInput",
  "FalseInput",
  "InputA",
  "InputB",
  "Input",
  "Solid",
  "Empty",
  "Low",
  "High",
  "Material",
  "Materials",
  "Queue",
]);

export function resolveImportNodeType(
  assetType: string,
  parentFieldName?: string,
  importCategory?: ImportGraphCategory,
): string {
  if (assetType.includes(":")) return assetType;

  const bareBundlePrefix = editorPrefixFromBareBundleType(assetType);
  const schemaCategory = getSchemaCategory(assetType)
    ?? (bareBundlePrefix ? AssetCategory.Curve : null);

  let prefix = parentFieldName ? FIELD_CATEGORY_PREFIX[parentFieldName] : null;

  // Density Mix under curve nesting is still density Mix, not Curve:Mix.
  if (
    parentFieldName
    && CURVE_NESTING_FIELDS.has(parentFieldName)
    && bundleNodes[assetType]?.category === "Density"
  ) {
    return assetType;
  }
  // Prop Conditional.Condition holds density; material graphs use Condition:* children.
  if (parentFieldName === "Condition") {
    prefix = isConditionSchemaType(assetType) ? "Condition" : "";
  }
  if (
    !prefix
    && importCategory === "material"
    && parentFieldName
    && MATERIAL_NESTED_FIELDS.has(parentFieldName)
  ) {
    prefix = "Material";
  }

  const schemaPrefix =
    bareBundlePrefix
    ?? (schemaCategory ? SCHEMA_CATEGORY_PREFIX[schemaCategory] : null);
  if (prefix) {
    return `${prefix}:${assetType}`;
  }

  if (schemaPrefix) return `${schemaPrefix}:${assetType}`;

  if (NON_DENSITY_BARE_SCHEMA_TYPES.has(assetType)) {
    const fallbackPrefix = editorPrefixFromBareBundleType(assetType)
      ?? (getSchemaCategory(assetType)
        ? SCHEMA_CATEGORY_PREFIX[getSchemaCategory(assetType)!]
        : null);
    if (fallbackPrefix) return `${fallbackPrefix}:${assetType}`;
  }

  return assetType;
}

/**
 * Convert a V2 JSON asset into React Flow nodes and edges.
 * Nested assets become separate nodes connected by edges.
 */
export function jsonToGraph(json: V2Asset, startX = 0, startY = 0, idPrefix = "graph", rootParentField?: string): GraphResult {
  let localCounter = 0;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const importCategory = rootParentField
    ? ROOT_FIELD_IMPORT_CATEGORY[rootParentField]
    : undefined;

  function nextId(): string {
    return `${idPrefix}_${++localCounter}`;
  }

  function processAsset(asset: V2Asset, x: number, y: number, parentFieldName?: string): string {
    // Use preserved Hytale $NodeId when available so positions from
    // $NodeEditorMetadata can be matched; fall back to auto-generated ID.
    const hytaleId = (asset as Record<string, unknown>).__hytaleNodeId as string | undefined;
    const nodeId = hytaleId ?? nextId();
    const fields: Record<string, unknown> = {};
    let childIndex = 0;
    const rawType = asset.Type ?? "unknown";

    // Detect vector constant: bare "Constant" with vector-shaped Value {x, y, z}.
    // Density constants always have numeric Values; vector constants have object Values.
    const isVectorValue =
      rawType === "Constant" &&
      asset.Value != null &&
      typeof asset.Value === "object" &&
      !Array.isArray(asset.Value) &&
      "x" in (asset.Value as Record<string, unknown>);
    const nodeType = isVectorValue
      ? "Vector:Constant"
      : resolveImportNodeType(rawType, parentFieldName, importCategory);

    for (const [key, value] of Object.entries(asset)) {
      if (key === "Type" || key === "__hytaleNodeId") continue;

      // Restore disconnected subtrees as independent roots (no edge to parent)
      if (key === "$DisconnectedTrees" && Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          processAsset(value[i] as V2Asset, x + 400, y + i * 300);
        }
        continue;
      }

      // Check if this field is a nested asset
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        "Type" in (value as Record<string, unknown>)
      ) {
        const childId = processAsset(value as V2Asset, x - 300, y + childIndex * 150, key);
        edges.push({
          id: `edge_${childId}_${nodeId}`,
          source: childId,
          sourceHandle: "output",
          target: nodeId,
          targetHandle: migrateHandle(nodeType, rawType, key),
        });
        childIndex++;
      } else if (
        Array.isArray(value) &&
        value.length > 0 &&
        typeof value[0] === "object" &&
        value[0] !== null &&
        "Type" in value[0]
      ) {
        // Array of nested assets (e.g., Inputs for Sum)
        const namedHandles = (key === "Inputs") ? HYTALE_ARRAY_TO_NAMED[rawType] : undefined;
        for (let i = 0; i < value.length; i++) {
          const childId = processAsset(value[i] as V2Asset, x - 300, y + childIndex * 150, key);
          const targetHandle = (namedHandles && i < namedHandles.length)
            ? namedHandles[i]
            : `${key}[${i}]`;
          edges.push({
            id: `edge_${childId}_${nodeId}`,
            source: childId,
            sourceHandle: "output",
            target: nodeId,
            targetHandle,
          });
          childIndex++;
        }
      } else {
        fields[key] = value;
      }
    }

    nodes.push({
      id: nodeId,
      type: nodeType,
      position: { x, y },
      data: {
        type: rawType,
        fields,
      },
    });

    return nodeId;
  }

  processAsset(json, startX, startY, rootParentField);
  return { nodes, edges };
}
