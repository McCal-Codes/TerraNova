import { AssetCategory } from "./types";

/**
 * Short editor prefixes (React Flow node.type) → full bundle category names.
 * Density nodes use bare names only — no prefix entry here.
 */
export const EDITOR_PREFIX_TO_BUNDLE_CATEGORY: Record<string, string> = {
  Material: "MaterialProvider",
  Position: "PositionProvider",
  Vector: "VectorProvider",
  Environment: "EnvironmentProvider",
  Tint: "TintProvider",
  Curve: "Curve",
  Pattern: "Pattern",
  Prop: "Prop",
  Scanner: "Scanner",
  Assignment: "Assignment",
  BlockMask: "BlockMask",
  Directionality: "Directionality",
  PropDistribution: "PropDistribution",
  Condition: "Condition",
  Layer: "Layer",
  PointGenerator: "PointGenerator",
  Terrain: "Terrain",
  CaveGenerator: "CaveGenerator",
  Generator: "Generator",
  Biome: "Biome",
  Noise: "Noise",
  ContentPredicate: "ContentPredicate",
  DistanceFunction: "DistanceFunction",
  ContentSupplier: "ContentSupplier",
  ReturnType: "ReturnType",
  GraphPass: "GraphPass",
  NodeSelector: "NodeSelector",
  NodeAction: "NodeAction",
  EdgeSelector: "EdgeSelector",
  EdgeAction: "EdgeAction",
};

/** Editor short prefix with colon → bundle full prefix with colon */
export const SHORT_TO_FULL_PREFIX: Record<string, string> = Object.fromEntries(
  Object.entries(EDITOR_PREFIX_TO_BUNDLE_CATEGORY)
    .filter(([short]) => short !== "Curve" && short !== "Pattern" && short !== "Prop")
    .filter(([short, full]) => short !== full)
    .map(([short, full]) => [`${short}:`, `${full}:`]),
);

/** Reverse: bundle full prefix → editor short prefix */
export const FULL_TO_SHORT_PREFIX: Record<string, string> = Object.fromEntries(
  Object.entries(SHORT_TO_FULL_PREFIX).map(([short, full]) => [full, short]),
);

/** AssetCategory → editor prefix for palette / legacy key resolution */
export const CATEGORY_TO_EDITOR_PREFIX: Partial<Record<AssetCategory, string>> = {
  [AssetCategory.Curve]: "Curve",
  [AssetCategory.MaterialProvider]: "Material",
  [AssetCategory.Pattern]: "Pattern",
  [AssetCategory.PositionProvider]: "Position",
  [AssetCategory.Prop]: "Prop",
  [AssetCategory.Scanner]: "Scanner",
  [AssetCategory.Assignment]: "Assignment",
  [AssetCategory.VectorProvider]: "Vector",
  [AssetCategory.EnvironmentProvider]: "Environment",
  [AssetCategory.TintProvider]: "Tint",
  [AssetCategory.BlockMask]: "BlockMask",
  [AssetCategory.Directionality]: "Directionality",
  [AssetCategory.PropDistribution]: "PropDistribution",
  [AssetCategory.Condition]: "Condition",
  [AssetCategory.Layer]: "Layer",
  [AssetCategory.PointGenerator]: "PointGenerator",
  [AssetCategory.Terrain]: "Terrain",
  [AssetCategory.CaveGenerator]: "CaveGenerator",
  [AssetCategory.Generator]: "Generator",
  [AssetCategory.Biome]: "Biome",
  [AssetCategory.Noise]: "Noise",
  [AssetCategory.ContentPredicate]: "ContentPredicate",
  [AssetCategory.DistanceFunction]: "DistanceFunction",
  [AssetCategory.ContentSupplier]: "ContentSupplier",
  [AssetCategory.ReturnType]: "ReturnType",
  [AssetCategory.GraphPass]: "GraphPass",
  [AssetCategory.NodeSelector]: "NodeSelector",
  [AssetCategory.NodeAction]: "NodeAction",
  [AssetCategory.EdgeSelector]: "EdgeSelector",
  [AssetCategory.EdgeAction]: "EdgeAction",
};

/** Bundle category string → AssetCategory enum */
export const BUNDLE_CATEGORY_TO_ASSET: Record<string, AssetCategory> = {
  Density: AssetCategory.Density,
  Curve: AssetCategory.Curve,
  MaterialProvider: AssetCategory.MaterialProvider,
  Pattern: AssetCategory.Pattern,
  PositionProvider: AssetCategory.PositionProvider,
  Prop: AssetCategory.Prop,
  Scanner: AssetCategory.Scanner,
  Assignment: AssetCategory.Assignment,
  VectorProvider: AssetCategory.VectorProvider,
  EnvironmentProvider: AssetCategory.EnvironmentProvider,
  TintProvider: AssetCategory.TintProvider,
  BlockMask: AssetCategory.BlockMask,
  Directionality: AssetCategory.Directionality,
  PropDistribution: AssetCategory.PropDistribution,
  Condition: AssetCategory.Condition,
  Layer: AssetCategory.Layer,
  PointGenerator: AssetCategory.PointGenerator,
  Terrain: AssetCategory.Terrain,
  CaveGenerator: AssetCategory.CaveGenerator,
  Generator: AssetCategory.Generator,
  Biome: AssetCategory.Biome,
  Noise: AssetCategory.Noise,
  ContentPredicate: AssetCategory.ContentPredicate,
  DistanceFunction: AssetCategory.DistanceFunction,
  ContentSupplier: AssetCategory.ContentSupplier,
  ReturnType: AssetCategory.ReturnType,
  GraphPass: AssetCategory.GraphPass,
  NodeSelector: AssetCategory.NodeSelector,
  NodeAction: AssetCategory.NodeAction,
  EdgeSelector: AssetCategory.EdgeSelector,
  EdgeAction: AssetCategory.EdgeAction,
};

/**
 * Parent JSON field name → editor prefix for nested asset Type resolution.
 * Empty string means bare density type.
 */
export const FIELD_CATEGORY_PREFIX: Record<string, string> = {
  Curve: "Curve",
  Pattern: "Pattern",
  SubPattern: "Pattern",
  PositionProvider: "Position",
  Positions: "Position",
  PropDistribution: "PropDistribution",
  PropDistributions: "PropDistribution",
  VectorProvider: "Vector",
  MaterialProvider: "Material",
  Scanner: "Scanner",
  ChildScanner: "Scanner",
  Prop: "Prop",
  Solid: "Material",
  Empty: "Material",
  Low: "Material",
  High: "Material",
  Floor: "Pattern",
  Ceiling: "Pattern",
  Surface: "Pattern",
  Top: "Assignment",
  Bottom: "Assignment",
  Layers: "Layer",
  Material: "Material",
  Materials: "Material",
  ThicknessFunctionXZ: "",
  NewYAxis: "Vector",
  Scale: "Vector",
  ReturnCurve: "Curve",
  AngleCurve: "Curve",
  DistanceCurve: "Curve",
  PinchCurve: "Curve",
  TwistCurve: "Curve",
  RadialCurve: "Curve",
  AxialCurve: "Curve",
  Curves: "Curve",
  Patterns: "Pattern",
  Queue: "Material",
  BlockMask: "BlockMask",
  Directionality: "Directionality",
  Distributor: "Position",
  Cluster: "Position",
  Scanners: "Scanner",
  Props: "Prop",
  Assignments: "Assignment",
  FieldFunction: "",
  Density: "",
  SolidityFunction: "",
  TerrainDensity: "",
  Pipeline: "",
};

export function stripEditorPrefix(typeKey: string): string {
  const idx = typeKey.indexOf(":");
  return idx >= 0 ? typeKey.slice(idx + 1) : typeKey;
}

export function resolveEditorTypeKey(bareType: string, editorPrefix: string): string {
  if (!editorPrefix || bareType.includes(":")) return bareType;
  return `${editorPrefix}:${bareType}`;
}

/** Expected bundle category for a type key (bare keys → Density). */
export function expectedBundleCategory(typeKey: string): string | null {
  const colonIdx = typeKey.indexOf(":");
  if (colonIdx < 0) return "Density";
  const shortPrefix = typeKey.slice(0, colonIdx);
  return EDITOR_PREFIX_TO_BUNDLE_CATEGORY[shortPrefix] ?? null;
}

export function toBundleTypeKey(editorTypeKey: string): string {
  for (const [short, full] of Object.entries(SHORT_TO_FULL_PREFIX)) {
    if (editorTypeKey.startsWith(short)) {
      return full + editorTypeKey.slice(short.length);
    }
  }
  return editorTypeKey;
}

export function toEditorTypeKey(bundleTypeKey: string): string {
  for (const [full, short] of Object.entries(FULL_TO_SHORT_PREFIX)) {
    if (bundleTypeKey.startsWith(full)) {
      return short + bundleTypeKey.slice(full.length);
    }
  }
  return bundleTypeKey;
}
