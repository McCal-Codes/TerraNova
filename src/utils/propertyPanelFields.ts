import { getNodeFields } from "@/schema/schemaLoader";
import { getDefaults } from "@/schema/defaults";
import type { CurveType } from "@/schema/curves";

const CURVE_TYPE_SET = new Set<string>([
  "Manual", "Constant", "DistanceExponential", "DistanceS", "Multiplier", "Sum",
  "Inverter", "Not", "Clamp", "LinearRemap", "Noise", "Cache", "Blend",
  "StepFunction", "Threshold", "SmoothStep", "Power", "Floor", "Ceiling",
  "SmoothFloor", "SmoothCeiling", "SmoothClamp", "Min", "Max", "SmoothMin",
  "SmoothMax", "Imported", "Exported",
]);

const INLINE_CURVE_FIELD_KEYS = new Set([
  "Curve", "ReturnCurve", "AngleCurve", "DistanceCurve", "RadialCurve", "AxialCurve",
]);

/** Prefer React Flow type key, then bare data.type. */
export function resolvePropertyPanelTypeKey(rfType: string, typeName: string): string {
  if (rfType && rfType !== "default" && rfType !== "generic") return rfType;
  return typeName;
}

export function isInlineCurveSpec(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const type = (value as Record<string, unknown>).Type;
  return typeof type === "string" && CURVE_TYPE_SET.has(type);
}

export function isInlineCurveFieldKey(key: string, value: unknown): boolean {
  if (!isInlineCurveSpec(value)) return false;
  return INLINE_CURVE_FIELD_KEYS.has(key) || key.endsWith("Curve");
}

/** Handle ids used for curve asset inputs on density / shape nodes. */
export const CURVE_INPUT_HANDLE_IDS = new Set(["Curve", "curve"]);

export function isCurveConstraintFieldKey(fieldKey: string): boolean {
  return fieldKey === "Curve" || fieldKey.endsWith("Curve");
}

export function hasConnectedCurveInput(
  nodeId: string,
  incomingByTarget: Map<string, Set<string>>,
): boolean {
  const handles = incomingByTarget.get(nodeId);
  if (!handles) return false;
  for (const handleId of handles) {
    if (CURVE_INPUT_HANDLE_IDS.has(handleId)) return true;
  }
  return false;
}

/** True when an inline curve spec or non-empty curve reference satisfies a required Curve field. */
export function hasInlineCurveField(
  fields: Record<string, unknown>,
  fieldKey = "Curve",
): boolean {
  const value = fields[fieldKey];
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "object" && !Array.isArray(value)) {
    return isInlineCurveSpec(value) || Object.keys(value as object).length > 0;
  }
  return false;
}

export function isCurveFieldConstraintSatisfied(
  fieldKey: string,
  fields: Record<string, unknown>,
  nodeId: string,
  incomingByTarget: Map<string, Set<string>>,
): boolean {
  if (!isCurveConstraintFieldKey(fieldKey)) return false;
  return hasConnectedCurveInput(nodeId, incomingByTarget)
    || hasInlineCurveField(fields, fieldKey);
}

export function curveSpecDefaults(type: string): Record<string, unknown> {
  const prefixed = getDefaults(`Curve:${type}`);
  const bare = getDefaults(type);
  const base = Object.keys(prefixed).length > 0 ? prefixed : bare;
  return { Type: type, ...base };
}

export function getFieldDefaultValue(typeKey: string, fieldKey: string): unknown | undefined {
  const defaults = getDefaults(typeKey);
  if (fieldKey in defaults) return defaults[fieldKey];
  const schemaField = getNodeFields(typeKey).find((f) => f.name === fieldKey);
  return schemaField?.default;
}

export interface PropertyFieldVisibilityContext {
  isWeightedAssignmentNode: boolean;
  isAssignmentFieldFunctionNode: boolean;
  isMaterialFieldFunctionNode: boolean;
  isColumnPropNode: boolean;
  isPrefabNode: boolean;
}

export function shouldSkipPropertyField(
  key: string,
  ctx: PropertyFieldVisibilityContext,
): boolean {
  if (key.startsWith("__")) return true;
  if (key === "_comment") return true;
  if (key.startsWith("$")) return true;
  if (ctx.isWeightedAssignmentNode && (key === "WeightedAssignments" || key === "ExportAs")) return true;
  if (ctx.isAssignmentFieldFunctionNode && key === "Delimiters") return true;
  if (ctx.isMaterialFieldFunctionNode && (key === "Materials" || key === "DelimiterRanges" || key === "Delimiters")) return true;
  if (ctx.isMaterialFieldFunctionNode && key === "ExportAs") return true;
  if (ctx.isAssignmentFieldFunctionNode && key === "ExportAs") return true;
  if (ctx.isColumnPropNode && (key === "ColumnBlocks" || key === "Height" || key === "Material" || key === "Scanner")) return true;
  if (ctx.isPrefabNode && key === "WeightedPrefabPaths") return true;
  if (ctx.isMaterialFieldFunctionNode && key === "DelimiterRanges") return true;
  return false;
}

/** Schema order first, then remaining keys alphabetically. */
export function getOrderedFieldKeys(
  typeKey: string,
  fields: Record<string, unknown>,
  skipField: (key: string) => boolean,
): string[] {
  const schemaOrder = getNodeFields(typeKey).map((f) => f.name);
  const present = new Set(Object.keys(fields));
  const ordered: string[] = [];

  for (const name of schemaOrder) {
    if (present.has(name) && !skipField(name)) ordered.push(name);
  }
  for (const name of [...present].sort()) {
    if (!ordered.includes(name) && !skipField(name)) ordered.push(name);
  }
  return ordered;
}

export function matchesFieldFilter(
  key: string,
  fieldLabel: string,
  filter: string,
): boolean {
  const q = filter.trim().toLowerCase();
  if (!q) return true;
  return key.toLowerCase().includes(q) || fieldLabel.toLowerCase().includes(q);
}

export const COMMON_CURVE_TYPES: CurveType[] = [
  "Manual",
  "Constant",
  "DistanceExponential",
  "DistanceS",
  "Clamp",
  "Inverter",
  "LinearRemap",
  "Power",
  "SmoothStep",
  "Threshold",
];
