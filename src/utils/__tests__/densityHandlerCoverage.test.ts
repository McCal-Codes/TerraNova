import { describe, it, expect } from "vitest";
import bundle from "@/data/terranova-bundle.json";
import { buildAllHandlers } from "@/utils/density/handlers";
import { DENSITY_TYPES, UNSUPPORTED_TYPES, getEvalStatus } from "@/utils/density/evalTypes";
import { EvalStatus } from "@/schema/types";

describe("density handler coverage", () => {
  const handlers = buildAllHandlers();

  it("every DENSITY_TYPES entry has a handler or explicit unsupported status", () => {
    const missing: string[] = [];
    for (const type of DENSITY_TYPES) {
      if (handlers.has(type)) continue;
      if (UNSUPPORTED_TYPES.has(type)) continue;
      missing.push(type);
    }
    expect(missing).toEqual([]);
  });

  it("bundle density node types are registered or marked unsupported", () => {
    const bundleTypes = Object.keys(bundle.nodes).filter((key) => {
      const node = bundle.nodes[key as keyof typeof bundle.nodes] as {
        category?: string;
        nodeType?: string;
        inputs?: unknown[];
      };
      const row = node as { subcategory?: string; isSubType?: boolean };
      return node.category === "Density"
        && node.nodeType === key
        && row.subcategory !== "Enum"
        && row.isSubType !== true
        && Array.isArray(node.inputs);
    });

    const gaps: string[] = [];
    for (const type of bundleTypes) {
      if (!DENSITY_TYPES.has(type)) continue;
      if (!handlers.has(type) && !UNSUPPORTED_TYPES.has(type)) {
        gaps.push(type);
      }
    }
    expect(gaps).toEqual([]);
  });

  it("terrain-specific legacy types are approximated, not unsupported", () => {
    for (const type of [
      "TerrainBoolean",
      "Pipeline",
      "CaveDensity",
      "SurfaceDensity",
      "TerrainMask",
      "BeardDensity",
      "ColumnDensity",
      "DistanceToBiomeEdge",
    ]) {
      expect(UNSUPPORTED_TYPES.has(type)).toBe(false);
      expect(getEvalStatus(type)).toBe(EvalStatus.Approximated);
      expect(handlers.has(type)).toBe(true);
    }
  });
});
