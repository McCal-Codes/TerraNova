import { describe, it, expect } from "vitest";
import bundle from "../../data/terranova-bundle.json";
import { hasSchemaNode } from "@/schema/schemaLoader";
import { nodeTypes } from "../index";
import { getHandles } from "../handleRegistry";
import { getNodeFields } from "@/schema/schemaLoader";
import { DENSITY_DEFAULTS } from "@/schema/defaults";
import {
  ACTIVE_V2_MISLABELED_DESCRIPTIONS,
  DEPRECATED_TYPE_KEYS,
  getLegacyReplacement,
  isDeprecatedOrLegacyTypeKey,
  isLegacyTypeKey,
  LEGACY_TYPE_KEYS,
  LEGACY_TYPE_REPLACEMENTS,
  NON_CANONICAL_PALETTE_TYPE_KEYS,
} from "../shared/legacyTypes";

describe("Deprecation alignment", () => {
  const nodes = bundle.nodes as Record<string, {
    nodeType: string;
    category: string;
    description?: string;
    fields?: Record<string, unknown>;
  }>;

  it("bundle-flagged deprecated/legacy nodes are classified or allowlisted", () => {
    for (const [key, node] of Object.entries(nodes)) {
      const description = node.description ?? "";
      if (!/(deprecated|legacy)/i.test(description)) continue;
      if (Object.keys(node.fields ?? {}).some((field) => /legacy/i.test(field))) continue;
      if (ACTIVE_V2_MISLABELED_DESCRIPTIONS.has(node.nodeType)) continue;

      const editorKey = key.includes(":") ? key.replace(/^MaterialProvider:/, "Material:").replace(/^PositionProvider:/, "Position:").replace(/^VectorProvider:/, "Vector:").replace(/^EnvironmentProvider:/, "Environment:").replace(/^TintProvider:/, "Tint:") : key;
      const classified =
        isLegacyTypeKey(editorKey)
        || isLegacyTypeKey(key)
        || NON_CANONICAL_PALETTE_TYPE_KEYS.has(editorKey)
        || DEPRECATED_TYPE_KEYS.has(editorKey)
        || DEPRECATED_TYPE_KEYS.has(key);

      expect(classified, `Unclassified bundle node ${key}: ${description}`).toBe(true);
    }
  });

  it("every replacement target is a type the editor can actually place", () => {
    // Not "has a bespoke React component": most types render through
    // GenericNode from their schema alone, so requiring a nodeTypes entry would
    // rule out perfectly placeable replacements such as PointGenerator:Mesh.
    for (const [, replacement] of LEGACY_TYPE_REPLACEMENTS) {
      const placeable = replacement in nodeTypes || hasSchemaNode(replacement);
      expect(placeable, `Replacement ${replacement} is not placeable`).toBe(true);
    }
  });

  it("every replacement target is not legacy or deprecated", () => {
    for (const [, replacement] of LEGACY_TYPE_REPLACEMENTS) {
      expect(isDeprecatedOrLegacyTypeKey(replacement)).toBe(false);
    }
  });

  it("MaterialProvider:Constant exists in bundle with Material field", () => {
    const node = nodes["MaterialProvider:Constant"];
    expect(node).toBeDefined();
    expect(node.category).toBe("MaterialProvider");
    expect(node.fields?.Material).toBeDefined();
  });

  it("density Constant resolves fields via legacy fallback", () => {
    expect("Constant" in DENSITY_DEFAULTS).toBe(true);
    const fields = getNodeFields("Constant");
    expect(fields.some((field) => field.name === "Value")).toBe(true);
  });

  it("Material:Constant resolves material fields from bundle or legacy map", () => {
    const fields = getNodeFields("Material:Constant");
    expect(fields.some((field) => field.name === "Material")).toBe(true);
  });

  it("registered node types (except chrome) resolve fields and handles", () => {
    const skip = new Set(["default", "comment", "frame", "group", "overviewSection", "sectionAnchor"]);
    for (const typeKey of Object.keys(nodeTypes)) {
      if (skip.has(typeKey)) continue;
      if (LEGACY_TYPE_KEYS.has(typeKey) && !nodeTypes[typeKey]) continue;
      expect(getHandles(typeKey).length, `${typeKey} handles`).toBeGreaterThan(0);
      if (!isLegacyTypeKey(typeKey)) {
        expect(getNodeFields(typeKey), `${typeKey} fields`).toBeDefined();
      }
    }
  });

  it("Cache2D maps to Cache replacement", () => {
    expect(getLegacyReplacement("Cache2D")).toBe("Cache");
    expect(DEPRECATED_TYPE_KEYS.has("Cache2D")).toBe(true);
  });

  it("material-prefixed layer thickness nodes map to Layer:* replacements", () => {
    expect(getLegacyReplacement("Material:ConstantThickness")).toBe("Layer:ConstantThickness");
    expect(getLegacyReplacement("Material:NoiseThickness")).toBe("Layer:NoiseThickness");
  });
});
